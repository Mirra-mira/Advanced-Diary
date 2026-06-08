// ── Shared state ─────────────────────────────────────────────
var notebooks = [];
var entries   = [];
var imageCache = {};          // imageId → base64 data

var activeNotebookId  = null;
var activeEntryId     = null;
var imgIndex          = 0;
var sortKey           = 'updatedAt-desc';
var filterDays        = 0;
var searchText        = '';
var pendingImgs       = [];   // mảng { id: string|null, data: base64 }
var editingNotebookId = null;
var editingEntryId    = null;
var sbTimer           = null;
var panelOpen         = false;
var notebookEditMode  = false;

const SK_KEY = 'adv_shortcuts_v1';

var shortcuts       = { entryOlder: 'a', entryNewer: 'd', imgPrev: 'q', imgNext: 'e' };
var capturingAction = null;

// ── Shortcuts (localStorage – thiết lập riêng máy) ───────────
function loadShortcuts() {
  try { Object.assign(shortcuts, JSON.parse(localStorage.getItem(SK_KEY) || '{}')); } catch {}
}

function saveShortcuts() {
  localStorage.setItem(SK_KEY, JSON.stringify(shortcuts));
}

// ── Firestore helpers ─────────────────────────────────────────
function userDoc() {
  return db.collection('users').doc(currentUser.uid);
}

// Load toàn bộ notebooks + entries từ Firestore khi khởi động
async function loadFromFirestore() {
  const [nbSnap, enSnap] = await Promise.all([
    userDoc().collection('notebooks').get(),
    userDoc().collection('entries').get()
  ]);

  notebooks  = nbSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  entries    = enSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  imageCache = {};

  // Lần đầu đăng nhập: chuyển data cũ từ localStorage lên Firestore
  if (!notebooks.length && !entries.length) {
    await migrateLocalToFirestore();
  }
}

// Lưu một notebook
async function saveNotebookDoc(nb) {
  const { id, ...data } = nb;
  await userDoc().collection('notebooks').doc(id).set(data);
}

// Lưu một entry (không lưu trường images cũ nếu còn)
async function saveEntryDoc(entry) {
  const { id, images, ...data } = entry; // bỏ trường images base64 cũ nếu tồn tại
  await userDoc().collection('entries').doc(id).set(data);
}

// Đồng bộ ảnh khi lưu entry:
//   - upload ảnh mới (id === null) lên collection images
//   - xóa ảnh đã bị loại (không còn trong pendingImgs)
//   - trả về imageIds[] theo đúng thứ tự pendingImgs
async function syncImages(entryId, pendingImgObjs, oldImageIds = []) {
  const imagesCol = userDoc().collection('images');

  const keptIds  = pendingImgObjs.filter(x => x.id).map(x => x.id);
  const toDelete = oldImageIds.filter(id => !keptIds.includes(id));
  const newItems = pendingImgObjs.filter(x => !x.id);

  await Promise.all(toDelete.map(id => {
    delete imageCache[id];
    return imagesCol.doc(id).delete();
  }));

  const newIds = await Promise.all(newItems.map(async img => {
    const ref = imagesCol.doc();
    await ref.set({ entryId, data: img.data, createdAt: new Date().toISOString() });
    imageCache[ref.id] = img.data;
    return ref.id;
  }));

  let newIdsCopy = [...newIds];
  return pendingImgObjs.map(x => x.id || newIdsCopy.shift());
}

// Load ảnh của một entry vào imageCache (chỉ fetch những ảnh chưa có)
async function loadEntryImages(entry) {
  const missing = (entry.imageIds || []).filter(id => !imageCache[id]);
  if (!missing.length) return;

  await Promise.all(missing.map(async id => {
    const doc = await userDoc().collection('images').doc(id).get();
    if (doc.exists) imageCache[id] = doc.data().data;
  }));
}

// Lấy mảng base64 của ảnh một entry từ cache
function getEntryImages(entry) {
  return (entry?.imageIds || []).map(id => imageCache[id]).filter(Boolean);
}

// Xóa một entry + ảnh của nó
async function deleteEntryDoc(entryId, imageIds = []) {
  await userDoc().collection('entries').doc(entryId).delete();
  await Promise.all(imageIds.map(id => {
    delete imageCache[id];
    return userDoc().collection('images').doc(id).delete();
  }));
}

// Xóa một notebook + toàn bộ entries + ảnh của nó
async function deleteNotebookDoc(nbId) {
  await userDoc().collection('notebooks').doc(nbId).delete();
  const nbEntries = entries.filter(e => e.notebookId === nbId);
  for (const entry of nbEntries) {
    await deleteEntryDoc(entry.id, entry.imageIds || []);
  }
}

// Migrate dữ liệu cũ từ localStorage lên Firestore (chỉ chạy lần đầu đăng nhập)
async function migrateLocalToFirestore() {
  const NB_KEY = 'adv_notebooks_v1';
  const EN_KEY = 'adv_entries_v1';
  let localNbs = [], localEns = [];
  try { localNbs = JSON.parse(localStorage.getItem(NB_KEY) || '[]'); } catch {}
  try { localEns = JSON.parse(localStorage.getItem(EN_KEY) || '[]'); } catch {}

  // Xử lý format rất cũ (adv_diary_v1)
  if (!localNbs.length) {
    const old = localStorage.getItem('adv_diary_v1');
    if (old) {
      try {
        const oldEntries = JSON.parse(old);
        if (oldEntries.length) {
          const now = new Date().toISOString();
          const nb  = { id: uid(), title: 'Nhật ký cũ', description: 'Được chuyển từ phiên bản trước', colorIndex: 0, createdAt: now, updatedAt: now };
          localNbs  = [nb];
          localEns  = oldEntries.map(o => ({
            id: uid(), notebookId: nb.id,
            noteDate: o.noteDate || o.createdAt.split('T')[0],
            content:  [o.title, o.description].filter(Boolean).join('\n\n'),
            images:   o.images || [],
            createdAt: o.createdAt, updatedAt: o.updatedAt
          }));
        }
      } catch {}
    }
  }

  if (!localNbs.length && !localEns.length) return;

  for (const nb of localNbs) {
    const { id, ...data } = nb;
    await userDoc().collection('notebooks').doc(id).set(data);
    notebooks.push(nb);
  }

  for (const entry of localEns) {
    const { id, images = [], ...data } = entry;
    const imageIds = [];
    for (const base64 of images) {
      const ref = userDoc().collection('images').doc();
      await ref.set({ entryId: id, data: base64, createdAt: data.createdAt });
      imageCache[ref.id] = base64;
      imageIds.push(ref.id);
    }
    await userDoc().collection('entries').doc(id).set({ ...data, imageIds });
    entries.push({ id, ...data, imageIds });
  }
}

// ── Misc helpers ──────────────────────────────────────────────
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function goTo(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(viewId).classList.add('active');
}
