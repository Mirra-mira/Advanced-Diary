function openNotebook(id) {
  activeNotebookId = id;
  imgIndex         = 0;

  const nb = notebooks.find(x => x.id === id);
  document.getElementById('nb-title-display').textContent = nb?.title || '';

  const sorted = entries
    .filter(e => e.notebookId === id)
    .sort((a, b) => b.noteDate.localeCompare(a.noteDate));

  // Giữ entry đang mở nếu vẫn thuộc notebook này, ngược lại chọn mới nhất
  if (!activeEntryId || !sorted.find(e => e.id === activeEntryId)) {
    activeEntryId = sorted.length ? sorted[0].id : null;
  }

  goTo('view-notebook');
  renderEntryList();
  renderEntryContent();
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
    });
  });
}

function updateEntryNav() {
  const bar    = document.getElementById('entry-nav-bar');
  const sorted = entries
    .filter(e => e.notebookId === activeNotebookId)
    .sort((a, b) => b.noteDate.localeCompare(a.noteDate));
  const idx = sorted.findIndex(e => e.id === activeEntryId);
  if (idx === -1) { bar.classList.add('hidden'); return; }
  bar.classList.remove('hidden');
  document.getElementById('btn-entry-older').disabled = idx >= sorted.length - 1;
  document.getElementById('btn-entry-newer').disabled = idx <= 0;
}

function navigateEntry(direction) {
  const sorted = entries
    .filter(e => e.notebookId === activeNotebookId)
    .sort((a, b) => b.noteDate.localeCompare(a.noteDate));
  const idx = sorted.findIndex(e => e.id === activeEntryId);
  if (idx === -1) return;
  const target = sorted[idx + direction];
  if (!target) return;
  activeEntryId = target.id;
  imgIndex = 0;
  renderEntryContent();
  renderEntryList();
}

function renderEntryContent() {
  const entry = entries.find(e => e.id === activeEntryId);

  const editFab = document.getElementById('btn-edit-entry');

  if (!entry) {
    document.getElementById('entry-view').classList.add('hidden');
    document.getElementById('entry-empty').classList.remove('hidden');
    editFab.classList.add('hidden');
    updateEntryNav();
    return;
  }

  document.getElementById('entry-view').classList.remove('hidden');
  document.getElementById('entry-empty').classList.add('hidden');
  editFab.classList.remove('hidden');
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
  updateEntryNav();
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

function openPanel() {
  panelOpen = true;
  document.getElementById('entry-panel').classList.add('open');
  document.getElementById('entry-overlay').classList.remove('hidden');
  document.getElementById('btn-panel-toggle').textContent = '‹';
}

function closePanel() {
  panelOpen = false;
  document.getElementById('entry-panel').classList.remove('open');
  document.getElementById('entry-overlay').classList.add('hidden');
  document.getElementById('btn-panel-toggle').textContent = '›';
}

function togglePanel() {
  if (panelOpen) closePanel(); else openPanel();
}

function initCarouselSwipe() {
  const display = document.getElementById('img-display');
  let startX = 0;

  display.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
  }, { passive: true });

  display.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) < 40) return;
    const entry = entries.find(x => x.id === activeEntryId);
    const imgs  = entry?.images || [];
    if (imgs.length <= 1) return;
    imgIndex = dx < 0
      ? (imgIndex + 1) % imgs.length
      : (imgIndex - 1 + imgs.length) % imgs.length;
    renderCarousel(imgs);
  }, { passive: true });
}

// Touch-only drag (mouse drag removed to prevent text selection)
function initTouchDrag() {
  const view = document.getElementById('view-notebook');
  let startX = 0, dragging = false;

  view.addEventListener('touchstart', e => {
    startX   = e.touches[0].clientX;
    dragging = startX < 32;
  }, { passive: true });

  view.addEventListener('touchmove', e => {
    if (!dragging) return;
    const dx = e.touches[0].clientX - startX;
    if (!panelOpen && dx > 50)  openPanel();
    if ( panelOpen && dx < -40) closePanel();
  }, { passive: true });

  view.addEventListener('touchend', () => { dragging = false; });
}
