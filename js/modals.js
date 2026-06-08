// ---- Settings ----
function openSettingsModal() {
  document.getElementById('btn-toggle-theme').textContent = currentThemeLabel();
  document.getElementById('settings-modal').classList.remove('hidden');
}

function closeSettingsModal() {
  document.getElementById('settings-modal').classList.add('hidden');
}

// ---- Shortcuts ----
function openShortcutsModal() {
  renderKeyBtns();
  document.getElementById('shortcuts-modal').classList.remove('hidden');
}

function closeShortcutsModal() {
  if (capturingAction) {
    const btn = document.querySelector(`.key-btn[data-action="${capturingAction}"]`);
    if (btn) { btn.textContent = displayKey(shortcuts[capturingAction]); btn.classList.remove('listening'); }
    capturingAction = null;
  }
  document.getElementById('shortcuts-modal').classList.add('hidden');
}

function renderKeyBtns() {
  document.querySelectorAll('.key-btn').forEach(btn => {
    btn.textContent = displayKey(shortcuts[btn.dataset.action]);
    btn.classList.remove('listening');
  });
}

// ---- Notebook ----
function openNotebookModal(nb) {
  editingNotebookId = nb ? nb.id : null;
  document.getElementById('nb-modal-heading').textContent = nb ? 'Sửa sổ nhật ký' : 'Sổ nhật ký mới';
  document.getElementById('nb-title-input').value         = nb ? nb.title : '';
  document.getElementById('nb-desc-input').value          = nb ? (nb.description || '') : '';
  document.getElementById('notebook-modal').classList.remove('hidden');
  document.getElementById('nb-title-input').focus();
}

function closeNotebookModal() {
  document.getElementById('notebook-modal').classList.add('hidden');
  editingNotebookId = null;
}

function saveNotebook() {
  const title = document.getElementById('nb-title-input').value.trim();
  if (!title) {
    const el = document.getElementById('nb-title-input');
    el.focus(); el.style.borderColor = 'var(--red)';
    setTimeout(() => (el.style.borderColor = ''), 1500);
    return;
  }
  const desc = document.getElementById('nb-desc-input').value.trim();
  const now  = new Date().toISOString();
  let nb;

  if (editingNotebookId) {
    nb = notebooks.find(x => x.id === editingNotebookId);
    Object.assign(nb, { title, description: desc, updatedAt: now });
    document.getElementById('nb-title-display').textContent = title;
  } else {
    nb = { id: uid(), title, description: desc, colorIndex: Math.floor(Math.random() * COVER_COLORS.length), createdAt: now, updatedAt: now };
    notebooks.unshift(nb);
  }

  saveNotebookDoc(nb).catch(console.error); // fire-and-forget
  closeNotebookModal();
  renderMain();
}

// ---- Entry ----
// async vì cần load ảnh từ Firestore trước khi mở modal
async function openEntryModal(entry) {
  editingEntryId = entry ? entry.id : null;
  pendingImgs    = [];

  if (entry && entry.imageIds && entry.imageIds.length) {
    await loadEntryImages(entry);
    // pendingImgs giờ là [{id, data}] để theo dõi ảnh cũ vs mới
    pendingImgs = entry.imageIds.map(id => ({ id, data: imageCache[id] || '' }));
  }

  document.getElementById('entry-modal-heading').textContent = entry ? 'Sửa trang nhật ký' : 'Thêm trang nhật ký';
  document.getElementById('entry-date-input').value          = entry ? entry.noteDate : todayIso();
  document.getElementById('entry-content-input').value       = entry ? (entry.content || '') : '';

  renderEntryPreviews();
  document.getElementById('entry-modal').classList.remove('hidden');
  document.getElementById('entry-content-input').focus();
}

function closeEntryModal() {
  document.getElementById('entry-modal').classList.add('hidden');
  pendingImgs    = [];
  editingEntryId = null;
}

function renderEntryPreviews() {
  const el = document.getElementById('entry-img-previews');
  // pendingImgs là [{id, data}] – dùng .data để hiển thị ảnh
  el.innerHTML = pendingImgs.map((img, i) => `
    <div class="preview-wrap">
      <img src="${img.data}" alt="">
      <button class="preview-remove" data-i="${i}">×</button>
    </div>
  `).join('');

  el.querySelectorAll('.preview-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      pendingImgs.splice(+btn.dataset.i, 1);
      renderEntryPreviews();
    });
  });

  const remaining = 7 - pendingImgs.length;
  document.getElementById('entry-upload-text').textContent =
    remaining > 0 ? `+ Thêm ảnh hoặc paste (còn ${remaining} chỗ)` : 'Đã đủ 7 ảnh';
}

async function saveEntry() {
  const noteDate = document.getElementById('entry-date-input').value || todayIso();
  const content  = document.getElementById('entry-content-input').value.trim();
  const now      = new Date().toISOString();

  const oldEntry    = editingEntryId ? entries.find(x => x.id === editingEntryId) : null;
  const oldImageIds = oldEntry ? (oldEntry.imageIds || []) : [];
  const entryId     = editingEntryId || uid();

  // Đồng bộ ảnh: upload mới, xóa bị loại, trả về imageIds[]
  const imageIds = await syncImages(entryId, pendingImgs, oldImageIds);

  if (editingEntryId) {
    const entry = entries.find(x => x.id === editingEntryId);
    Object.assign(entry, { noteDate, content, imageIds, updatedAt: now });
  } else {
    const newEntry = { id: entryId, notebookId: activeNotebookId, noteDate, content, imageIds, createdAt: now, updatedAt: now };
    entries.push(newEntry);
    activeEntryId = newEntry.id;
  }

  const entryToSave = entries.find(x => x.id === entryId);
  await saveEntryDoc(entryToSave);

  // Cập nhật updatedAt của notebook
  const nb = notebooks.find(x => x.id === activeNotebookId);
  if (nb) { nb.updatedAt = now; saveNotebookDoc(nb).catch(console.error); }

  imgIndex = 0;
  closeEntryModal();
  renderEntryList();
  renderEntryContent();
}
