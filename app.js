// ============================================================
// STATE
// ============================================================
let notebooks = [];
let entries   = [];
let activeNotebookId  = null;
let activeEntryId     = null;
let imgIndex          = 0;
let sortKey           = 'updatedAt-desc';
let filterDays        = 0;
let searchText        = '';
let editingNotebookId = null;
let editingEntryId    = null;
let pendingImgs       = [];
let sbTimer           = null;
let panelOpen         = false;
let dragStartX        = 0;
let isDragging        = false;

// ============================================================
// STORAGE
// ============================================================
const NB_KEY = 'adv_notebooks_v1';
const EN_KEY = 'adv_entries_v1';

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

// Chuyển data từ phiên bản cũ (adv_diary_v1) sang cấu trúc mới
function migrateOldData() {
  const OLD_KEY = 'adv_diary_v1';
  const old = localStorage.getItem(OLD_KEY);
  if (!old || notebooks.length) return; // Đã có data mới → bỏ qua

  try {
    const oldEntries = JSON.parse(old);
    if (!oldEntries.length) return;

    const now = new Date().toISOString();
    const nb  = {
      id: uid(), title: 'Nhật ký cũ',
      description: 'Được chuyển từ phiên bản trước',
      colorIndex: 0, createdAt: now, updatedAt: now
    };
    notebooks.push(nb);

    oldEntries.forEach(o => {
      entries.push({
        id: uid(), notebookId: nb.id,
        noteDate: o.noteDate || o.createdAt.split('T')[0],
        content:  [o.title, o.description].filter(Boolean).join('\n\n'),
        images:   o.images || [],
        createdAt: o.createdAt, updatedAt: o.updatedAt
      });
    });

    saveAll();
  } catch { /* bỏ qua lỗi migration */ }
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ============================================================
// IMAGE COMPRESSION
// ============================================================
function compressImg(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const MAX = 720;
        let w = img.width, h = img.height;
        if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
        else        { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL('image/jpeg', 0.65));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ============================================================
// HELPERS
// ============================================================
function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fmtDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr.length === 10 ? dateStr + 'T00:00:00' : dateStr);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

const DAYS_VI = ['Chủ nhật','Thứ hai','Thứ ba','Thứ tư','Thứ năm','Thứ sáu','Thứ bảy'];

function fmtFullDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${DAYS_VI[d.getDay()]}, ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

function todayIso() {
  return new Date().toISOString().split('T')[0];
}

const COVER_COLORS = [
  'linear-gradient(135deg,#667eea,#764ba2)',
  'linear-gradient(135deg,#f093fb,#f5576c)',
  'linear-gradient(135deg,#4facfe,#00f2fe)',
  'linear-gradient(135deg,#43e97b,#38f9d7)',
  'linear-gradient(135deg,#fa709a,#fee140)',
  'linear-gradient(135deg,#a18cd1,#fbc2eb)',
  'linear-gradient(135deg,#fccb90,#d57eeb)',
  'linear-gradient(135deg,#e0c3fc,#8ec5fc)',
];

function coverGradient(nb) {
  return COVER_COLORS[(nb.colorIndex || 0) % COVER_COLORS.length];
}

// ============================================================
// VIEW ROUTING
// ============================================================
function goTo(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(viewId).classList.add('active');
}

// ============================================================
// MAIN VIEW
// ============================================================
function getFilteredNotebooks() {
  let list = [...notebooks];

  if (filterDays > 0) {
    const cut = Date.now() - filterDays * 86_400_000;
    list = list.filter(nb => +new Date(nb.updatedAt) >= cut);
  }
  if (searchText) {
    const q = searchText.toLowerCase();
    list = list.filter(nb => nb.title.toLowerCase().includes(q));
  }

  list.sort((a, b) => {
    switch (sortKey) {
      case 'updatedAt-desc': return +new Date(b.updatedAt) - +new Date(a.updatedAt);
      case 'createdAt-desc': return +new Date(b.createdAt) - +new Date(a.createdAt);
      case 'name-asc':       return a.title.localeCompare(b.title, 'vi');
      case 'name-desc':      return b.title.localeCompare(a.title, 'vi');
      default: return 0;
    }
  });

  return list;
}

function notebookMeta(nb) {
  const list = entries.filter(e => e.notebookId === nb.id);
  if (!list.length) return '0 trang';
  const latest = list.reduce((a, b) => a.noteDate > b.noteDate ? a : b);
  return `${list.length} trang · ${fmtDate(latest.noteDate)}`;
}

function renderMain() {
  const grid = document.getElementById('notebooks-grid');
  const list = getFilteredNotebooks();

  if (!list.length) {
    grid.innerHTML = `<div class="empty-state">Chưa có sổ nhật ký nào.<br>Nhấn <strong>+</strong> để tạo sổ đầu tiên.</div>`;
    return;
  }

  grid.innerHTML = `<div class="cards-row">` + list.map(nb => `
    <div class="notebook-card" data-id="${nb.id}">
      <div class="notebook-cover" style="background:${coverGradient(nb)}"></div>
      <div class="notebook-body">
        <div class="notebook-title">${esc(nb.title)}</div>
        <div class="notebook-desc">${esc(nb.description || '')}</div>
        <div class="notebook-meta">${notebookMeta(nb)}</div>
      </div>
    </div>
  `).join('') + `</div>`;

  grid.querySelectorAll('.notebook-card').forEach(card => {
    card.addEventListener('click', () => openNotebook(card.dataset.id));
  });
}

// ============================================================
// CUSTOM SCROLLBAR
// ============================================================
function initScrollbar() {
  const grid  = document.getElementById('notebooks-grid');
  const bar   = document.getElementById('custom-scrollbar');
  const thumb = document.getElementById('scrollbar-thumb');

  grid.addEventListener('scroll', () => {
    const ratio = grid.clientHeight / grid.scrollHeight;
    if (ratio >= 1) { bar.classList.remove('show'); return; }

    bar.style.top    = grid.offsetTop + 'px';
    bar.style.height = grid.clientHeight + 'px';

    const thumbH = Math.max(28, ratio * grid.clientHeight);
    const thumbY = (grid.scrollTop / (grid.scrollHeight - grid.clientHeight))
                   * (grid.clientHeight - thumbH);
    thumb.style.height = thumbH + 'px';
    thumb.style.top    = thumbY + 'px';

    bar.classList.add('show');
    clearTimeout(sbTimer);
    sbTimer = setTimeout(() => bar.classList.remove('show'), 3000);
  });
}

// ============================================================
// NOTEBOOK VIEW
// ============================================================
function openNotebook(id) {
  activeNotebookId = id;
  activeEntryId    = null;
  imgIndex         = 0;

  const nb = notebooks.find(x => x.id === id);
  document.getElementById('nb-title-display').textContent = nb?.title || '';

  // Chọn trang mới nhất mặc định
  const sorted = entries
    .filter(e => e.notebookId === id)
    .sort((a, b) => b.noteDate.localeCompare(a.noteDate));
  if (sorted.length) activeEntryId = sorted[0].id;

  renderEntryList();
  renderEntryContent();
  goTo('view-notebook');
}

function renderEntryList() {
  const el   = document.getElementById('entry-list');
  const list = entries
    .filter(e => e.notebookId === activeNotebookId)
    .sort((a, b) => b.noteDate.localeCompare(a.noteDate));

  if (!list.length) {
    el.innerHTML = `<p class="no-entries-hint">Chưa có trang nào.<br>Nhấn <strong>+</strong> để thêm.</p>`;
    return;
  }

  el.innerHTML = list.map(e => `
    <div class="entry-item ${e.id === activeEntryId ? 'active' : ''}" data-id="${e.id}">
      <div class="entry-item-date">${fmtDate(e.noteDate)}</div>
      <div class="entry-item-preview">${esc(e.content.slice(0, 55))}</div>
    </div>
  `).join('');

  el.querySelectorAll('.entry-item').forEach(item => {
    item.addEventListener('click', () => {
      activeEntryId = item.dataset.id;
      imgIndex = 0;
      renderEntryContent();
      renderEntryList();
      closePanel();
    });
  });
}

function renderEntryContent() {
  const entry = entries.find(e => e.id === activeEntryId);

  if (!entry) {
    document.getElementById('entry-view').classList.add('hidden');
    document.getElementById('entry-empty').classList.remove('hidden');
    return;
  }

  document.getElementById('entry-view').classList.remove('hidden');
  document.getElementById('entry-empty').classList.add('hidden');

  document.getElementById('entry-date-display').textContent = fmtFullDate(entry.noteDate);

  const descEl = document.getElementById('entry-desc-display');
  if (entry.content) {
    descEl.textContent = entry.content;
    descEl.classList.remove('muted');
  } else {
    descEl.textContent = 'Nội dung nhật ký ghi ở đây';
    descEl.classList.add('muted');
  }

  renderCarousel(entry.images || []);
}

function renderCarousel(imgs) {
  const display = document.getElementById('img-display');
  const dots    = document.getElementById('img-dots');
  const prev    = document.getElementById('img-prev');
  const next    = document.getElementById('img-next');

  if (!imgs.length) {
    display.innerHTML = `<p class="no-img-text">Không có ảnh nào vào lúc này</p>`;
    dots.innerHTML    = '';
    prev.disabled = next.disabled = true;
    return;
  }

  if (imgIndex >= imgs.length) imgIndex = 0;
  display.innerHTML = `<img src="${imgs[imgIndex]}" alt="Ảnh ${imgIndex + 1}">`;
  prev.disabled = next.disabled = imgs.length <= 1;

  dots.innerHTML = imgs.map((_, i) =>
    `<button class="dot ${i === imgIndex ? 'active' : ''}" data-i="${i}"></button>`
  ).join('');

  dots.querySelectorAll('.dot').forEach(dot => {
    dot.addEventListener('click', () => {
      imgIndex = +dot.dataset.i;
      renderCarousel(imgs);
    });
  });
}

// ============================================================
// ENTRY PANEL SLIDE
// ============================================================
function openPanel() {
  panelOpen = true;
  document.getElementById('entry-panel').classList.add('open');
  document.getElementById('entry-overlay').classList.remove('hidden');
}

function closePanel() {
  panelOpen = false;
  document.getElementById('entry-panel').classList.remove('open');
  document.getElementById('entry-overlay').classList.add('hidden');
}

function initPanelDrag() {
  const view = document.getElementById('view-notebook');

  const onStart = x => { dragStartX = x; isDragging = x < 32; };
  const onMove  = x => {
    if (!isDragging) return;
    const dx = x - dragStartX;
    if (!panelOpen && dx >  50) openPanel();
    if ( panelOpen && dx < -40) closePanel();
  };
  const onEnd = () => { isDragging = false; };

  view.addEventListener('touchstart', e => onStart(e.touches[0].clientX), { passive: true });
  view.addEventListener('touchmove',  e => onMove(e.touches[0].clientX),  { passive: true });
  view.addEventListener('touchend',   onEnd);
  view.addEventListener('mousedown',  e => onStart(e.clientX));
  window.addEventListener('mousemove', e => { if (isDragging) onMove(e.clientX); });
  window.addEventListener('mouseup',  onEnd);
}

// ============================================================
// NOTEBOOK MODAL
// ============================================================
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

  if (editingNotebookId) {
    const nb = notebooks.find(x => x.id === editingNotebookId);
    Object.assign(nb, { title, description: desc, updatedAt: now });
    document.getElementById('nb-title-display').textContent = title;
  } else {
    notebooks.unshift({
      id: uid(), title, description: desc,
      colorIndex: Math.floor(Math.random() * COVER_COLORS.length),
      createdAt: now, updatedAt: now
    });
  }

  saveAll();
  closeNotebookModal();
  renderMain();
}

// ============================================================
// ENTRY MODAL
// ============================================================
function openEntryModal(entry) {
  editingEntryId = entry ? entry.id : null;
  pendingImgs    = entry ? [...(entry.images || [])] : [];

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
  el.innerHTML = pendingImgs.map((src, i) => `
    <div class="preview-wrap">
      <img src="${src}" alt="">
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

  if (editingEntryId) {
    const entry = entries.find(x => x.id === editingEntryId);
    Object.assign(entry, { noteDate, content, images: pendingImgs, updatedAt: now });
  } else {
    const newEntry = {
      id: uid(), notebookId: activeNotebookId,
      noteDate, content, images: pendingImgs,
      createdAt: now, updatedAt: now
    };
    entries.push(newEntry);
    activeEntryId = newEntry.id;
  }

  // Cập nhật updatedAt của notebook
  const nb = notebooks.find(x => x.id === activeNotebookId);
  if (nb) nb.updatedAt = now;

  imgIndex = 0;
  saveAll();
  closeEntryModal();
  renderEntryList();
  renderEntryContent();
}

// ============================================================
// EVENTS
// ============================================================
function bindEvents() {

  // --- Main topbar ---
  document.getElementById('btn-settings').addEventListener('click', () =>
    alert('Cài đặt sẽ được thêm vào ở phiên bản sau.'));

  document.getElementById('btn-search-toggle').addEventListener('click', () => {
    document.getElementById('search-panel').classList.toggle('hidden');
  });

  document.getElementById('btn-sort-toggle').addEventListener('click', () => {
    const panel  = document.getElementById('sort-panel');
    const isHide = panel.classList.toggle('hidden');
    document.getElementById('btn-sort-toggle').textContent = isHide ? 'Sửa' : 'Xong';
  });

  document.getElementById('search-input').addEventListener('input', e => {
    searchText = e.target.value;
    renderMain();
  });

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filterDays = +btn.dataset.days;
      renderMain();
    });
  });

  document.querySelectorAll('.sort-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      sortKey = btn.dataset.sort;
      renderMain();
    });
  });

  document.getElementById('btn-new-notebook').addEventListener('click', () => openNotebookModal(null));

  // --- Notebook topbar ---
  document.getElementById('btn-back').addEventListener('click', () => {
    closePanel();
    renderMain();
    goTo('view-main');
  });

  document.getElementById('btn-add-entry-top').addEventListener('click', () => openEntryModal(null));
  document.getElementById('btn-add-entry-panel').addEventListener('click', () => {
    closePanel();
    openEntryModal(null);
  });

  document.getElementById('btn-edit-notebook').addEventListener('click', () => {
    const nb = notebooks.find(x => x.id === activeNotebookId);
    if (nb) openNotebookModal(nb);
  });

  document.getElementById('btn-delete-notebook').addEventListener('click', () => {
    const nb = notebooks.find(x => x.id === activeNotebookId);
    if (!nb) return;
    if (!confirm(`Xóa sổ "${nb.title}" và toàn bộ ${entries.filter(e=>e.notebookId===nb.id).length} trang nhật ký trong đó?`)) return;
    notebooks = notebooks.filter(x => x.id !== activeNotebookId);
    entries   = entries.filter(x => x.notebookId !== activeNotebookId);
    saveAll();
    renderMain();
    goTo('view-main');
  });

  // --- Entry actions ---
  document.getElementById('btn-edit-entry').addEventListener('click', () => {
    const entry = entries.find(e => e.id === activeEntryId);
    if (entry) openEntryModal(entry);
  });

  document.getElementById('btn-delete-entry').addEventListener('click', () => {
    const entry = entries.find(e => e.id === activeEntryId);
    if (!entry) return;
    if (!confirm(`Xóa trang nhật ký ngày ${fmtDate(entry.noteDate)}?`)) return;
    entries = entries.filter(e => e.id !== activeEntryId);

    const remaining = entries
      .filter(e => e.notebookId === activeNotebookId)
      .sort((a, b) => b.noteDate.localeCompare(a.noteDate));
    activeEntryId = remaining.length ? remaining[0].id : null;
    imgIndex = 0;

    saveAll();
    renderEntryList();
    renderEntryContent();
  });

  // --- Carousel ---
  document.getElementById('img-prev').addEventListener('click', () => {
    const imgs = entries.find(e => e.id === activeEntryId)?.images || [];
    if (!imgs.length) return;
    imgIndex = (imgIndex - 1 + imgs.length) % imgs.length;
    renderCarousel(imgs);
  });

  document.getElementById('img-next').addEventListener('click', () => {
    const imgs = entries.find(e => e.id === activeEntryId)?.images || [];
    if (!imgs.length) return;
    imgIndex = (imgIndex + 1) % imgs.length;
    renderCarousel(imgs);
  });

  // --- Entry panel overlay ---
  document.getElementById('entry-overlay').addEventListener('click', closePanel);

  // --- Notebook modal ---
  document.getElementById('nb-modal-cancel').addEventListener('click', closeNotebookModal);
  document.getElementById('nb-modal-save').addEventListener('click', saveNotebook);
  document.getElementById('notebook-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('notebook-modal')) closeNotebookModal();
  });

  // --- Entry modal ---
  document.getElementById('entry-modal-cancel').addEventListener('click', closeEntryModal);
  document.getElementById('entry-modal-save').addEventListener('click', saveEntry);
  document.getElementById('entry-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('entry-modal')) closeEntryModal();
  });

  // --- File upload ---
  document.getElementById('entry-img-input').addEventListener('change', async e => {
    const slots = 7 - pendingImgs.length;
    if (!slots) return;
    for (const f of Array.from(e.target.files).slice(0, slots))
      pendingImgs.push(await compressImg(f));
    renderEntryPreviews();
    e.target.value = '';
  });

  // --- Paste ảnh (Ctrl+V khi modal entry đang mở) ---
  document.addEventListener('paste', async e => {
    if (document.getElementById('entry-modal').classList.contains('hidden')) return;
    const items = Array.from(e.clipboardData.items).filter(i => i.type.startsWith('image/'));
    if (!items.length) return;
    e.preventDefault();
    const slots = 7 - pendingImgs.length;
    for (const item of items.slice(0, slots)) {
      const file = item.getAsFile();
      if (file) pendingImgs.push(await compressImg(file));
    }
    renderEntryPreviews();
  });
}

// ============================================================
// INIT
// ============================================================
load();
renderMain();
initScrollbar();
initPanelDrag();
bindEvents();
