// Shared state
var notebooks = [];
var entries   = [];
var activeNotebookId  = null;
var activeEntryId     = null;
var imgIndex          = 0;
var sortKey           = 'updatedAt-desc';
var filterDays        = 0;
var searchText        = '';
var pendingImgs       = [];
var editingNotebookId = null;
var editingEntryId    = null;
var sbTimer           = null;
var panelOpen         = false;
var notebookEditMode  = false;

const NB_KEY = 'adv_notebooks_v1';
const EN_KEY = 'adv_entries_v1';
const SK_KEY = 'adv_shortcuts_v1';

var shortcuts = { entryOlder: 'a', entryNewer: 'd', imgPrev: 'q', imgNext: 'e' };
var capturingAction = null;

function loadShortcuts() {
  try { Object.assign(shortcuts, JSON.parse(localStorage.getItem(SK_KEY) || '{}')); } catch {}
}

function saveShortcuts() {
  localStorage.setItem(SK_KEY, JSON.stringify(shortcuts));
}

function load() {
  try { notebooks = JSON.parse(localStorage.getItem(NB_KEY) || '[]'); } catch { notebooks = []; }
  try { entries   = JSON.parse(localStorage.getItem(EN_KEY) || '[]'); } catch { entries   = []; }
  migrateOldData();
}

function saveAll() {
  try {
    localStorage.setItem(NB_KEY, JSON.stringify(notebooks));
    localStorage.setItem(EN_KEY, JSON.stringify(entries));
  } catch (e) {
    if (e.name === 'QuotaExceededError')
      alert('Bộ nhớ đầy! Vui lòng xóa bớt ảnh hoặc nhật ký cũ.');
  }
}

function migrateOldData() {
  const old = localStorage.getItem('adv_diary_v1');
  if (!old || notebooks.length) return;
  try {
    const list = JSON.parse(old);
    if (!list.length) return;
    const now = new Date().toISOString();
    const nb  = { id: uid(), title: 'Nhật ký cũ', description: 'Được chuyển từ phiên bản trước', colorIndex: 0, createdAt: now, updatedAt: now };
    notebooks.push(nb);
    list.forEach(o => entries.push({
      id: uid(), notebookId: nb.id,
      noteDate: o.noteDate || o.createdAt.split('T')[0],
      content:  [o.title, o.description].filter(Boolean).join('\n\n'),
      images: o.images || [], createdAt: o.createdAt, updatedAt: o.updatedAt
    }));
    saveAll();
  } catch { /* ignore */ }
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function goTo(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(viewId).classList.add('active');
}
