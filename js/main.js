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

function groupByMonth(list, dateField) {
  const groups  = [];
  const map     = new Map();
  const thisYear = new Date().getFullYear();
  list.forEach(nb => {
    const d   = new Date(nb[dateField]);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const label = d.getFullYear() === thisYear
      ? `Tháng ${d.getMonth() + 1}`
      : `Tháng ${d.getMonth() + 1}, ${d.getFullYear()}`;
    if (!map.has(key)) { const g = { label, items: [] }; map.set(key, g); groups.push(g); }
    map.get(key).items.push(nb);
  });
  return groups;
}

function cardHtml(nb) {
  return `
    <div class="notebook-card ${notebookEditMode ? 'edit-mode' : ''}" data-id="${nb.id}">
      ${notebookEditMode ? `
        <button class="card-btn-delete" data-id="${nb.id}" title="Xóa sổ">🗑</button>
        <button class="card-btn-edit"   data-id="${nb.id}" title="Sửa sổ">✏</button>
      ` : ''}
      <div class="notebook-cover" style="background:${coverGradient(nb)}"></div>
      <div class="notebook-body">
        <div class="notebook-title">${esc(nb.title)}</div>
        <div class="notebook-desc">${esc(nb.description || '')}</div>
        <div class="notebook-meta">${notebookMeta(nb)}</div>
      </div>
    </div>`;
}

function renderMain() {
  const grid = document.getElementById('notebooks-grid');
  const list = getFilteredNotebooks();

  if (!list.length) {
    grid.innerHTML = `<div class="empty-state">Chưa có sổ nhật ký nào.<br>Nhấn <strong>+</strong> để tạo sổ đầu tiên.</div>`;
    return;
  }

  const byDate = sortKey === 'updatedAt-desc' || sortKey === 'createdAt-desc';
  const field  = sortKey === 'createdAt-desc' ? 'createdAt' : 'updatedAt';

  if (byDate) {
    const groups = groupByMonth(list, field);
    grid.innerHTML = groups.map(g => `
      <div class="month-group">
        <div class="month-label">${g.label}</div>
        <div class="cards-row">${g.items.map(cardHtml).join('')}</div>
      </div>`).join('');
  } else {
    grid.innerHTML = `<div class="cards-row">${list.map(cardHtml).join('')}</div>`;
  }

  if (!notebookEditMode) {
    grid.querySelectorAll('.notebook-card').forEach(card => {
      card.addEventListener('click', () => openNotebook(card.dataset.id));
    });
  } else {
    grid.querySelectorAll('.card-btn-delete').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const nb    = notebooks.find(x => x.id === btn.dataset.id);
        if (!nb) return;
        const count = entries.filter(e => e.notebookId === nb.id).length;
        if (!confirm(`Xóa sổ "${nb.title}" và toàn bộ ${count} trang nhật ký?`)) return;
        const nbId = btn.dataset.id;
        deleteNotebookDoc(nbId).catch(console.error); // xóa Firestore
        notebooks = notebooks.filter(x => x.id !== nbId);
        entries   = entries.filter(x => x.notebookId !== nbId);
        renderMain();
      });
    });

    grid.querySelectorAll('.card-btn-edit').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const nb = notebooks.find(x => x.id === btn.dataset.id);
        if (nb) openNotebookModal(nb);
      });
    });
  }
}

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
    const thumbY = (grid.scrollTop / (grid.scrollHeight - grid.clientHeight)) * (grid.clientHeight - thumbH);
    thumb.style.height = thumbH + 'px';
    thumb.style.top    = thumbY + 'px';

    bar.classList.add('show');
    clearTimeout(sbTimer);
    sbTimer = setTimeout(() => bar.classList.remove('show'), 3000);
  });
}
