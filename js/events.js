function bindEvents() {

  // Main view
  document.getElementById('btn-settings').addEventListener('click', openSettingsModal);

  document.getElementById('btn-search-toggle').addEventListener('click', () =>
    document.getElementById('search-panel').classList.toggle('hidden'));

  document.getElementById('btn-filter-toggle').addEventListener('click', () => {
    const panel  = document.getElementById('sort-panel');
    const isHide = panel.classList.toggle('hidden');
    document.getElementById('btn-filter-toggle').textContent = isHide ? 'Lọc' : 'Xong';
  });

  document.getElementById('btn-edit-mode').addEventListener('click', () => {
    notebookEditMode = !notebookEditMode;
    document.getElementById('btn-edit-mode').textContent = notebookEditMode ? 'Xong' : 'Sửa';
    if (notebookEditMode) document.getElementById('btn-edit-mode').classList.add('active-mode');
    else                  document.getElementById('btn-edit-mode').classList.remove('active-mode');
    renderMain();
  });

  document.getElementById('search-input').addEventListener('input', e => {
    searchText = e.target.value; renderMain();
  });

  document.querySelectorAll('.filter-btn').forEach(btn =>
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filterDays = +btn.dataset.days;
      renderMain();
    }));

  document.querySelectorAll('.sort-btn').forEach(btn =>
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      sortKey = btn.dataset.sort;
      renderMain();
    }));

  document.getElementById('btn-new-notebook').addEventListener('click', () => openNotebookModal(null));

  // Notebook view
  document.getElementById('btn-back').addEventListener('click', () => { closePanel(); renderMain(); goTo('view-main'); });
  document.getElementById('btn-panel-toggle').addEventListener('click', togglePanel);
  document.getElementById('btn-add-entry-top').addEventListener('click', () => openEntryModal(null));
  document.getElementById('btn-add-entry-panel').addEventListener('click', () => { closePanel(); openEntryModal(null); });

  document.getElementById('btn-edit-notebook').addEventListener('click', () => {
    const nb = notebooks.find(x => x.id === activeNotebookId);
    if (nb) openNotebookModal(nb);
  });

  document.getElementById('btn-delete-notebook').addEventListener('click', () => {
    const nb = notebooks.find(x => x.id === activeNotebookId);
    if (!nb) return;
    const count = entries.filter(e => e.notebookId === nb.id).length;
    if (!confirm(`Xóa sổ "${nb.title}" và toàn bộ ${count} trang nhật ký trong đó?`)) return;
    notebooks = notebooks.filter(x => x.id !== activeNotebookId);
    entries   = entries.filter(x => x.notebookId !== activeNotebookId);
    saveAll(); renderMain(); goTo('view-main');
  });

  // Entry
  document.getElementById('btn-entry-older').addEventListener('click', () => navigateEntry(+1));
  document.getElementById('btn-entry-newer').addEventListener('click', () => navigateEntry(-1));

  document.getElementById('btn-edit-entry').addEventListener('click', () => {
    const entry = entries.find(e => e.id === activeEntryId);
    if (entry) openEntryModal(entry);
  });

  document.getElementById('btn-delete-entry').addEventListener('click', () => {
    const entry = entries.find(e => e.id === activeEntryId);
    if (!entry) return;
    if (!confirm(`Xóa trang nhật ký ngày ${fmtDate(entry.noteDate)}?`)) return;
    entries = entries.filter(e => e.id !== activeEntryId);
    const remaining = entries.filter(e => e.notebookId === activeNotebookId).sort((a,b) => b.noteDate.localeCompare(a.noteDate));
    activeEntryId = remaining.length ? remaining[0].id : null;
    imgIndex = 0;
    saveAll(); renderEntryList(); renderEntryContent();
  });

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

  document.getElementById('entry-overlay').addEventListener('click', closePanel);

  // Settings modal
  document.getElementById('settings-close').addEventListener('click', closeSettingsModal);
  document.getElementById('settings-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('settings-modal')) closeSettingsModal();
  });
  document.getElementById('btn-toggle-theme').addEventListener('click', () => {
    toggleTheme();
    document.getElementById('btn-toggle-theme').textContent = currentThemeLabel();
  });
  document.getElementById('btn-open-shortcuts').addEventListener('click', openShortcutsModal);

  // Shortcuts modal
  document.getElementById('shortcuts-close').addEventListener('click', closeShortcutsModal);
  document.getElementById('shortcuts-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('shortcuts-modal')) closeShortcutsModal();
  });
  document.querySelectorAll('.key-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (capturingAction === btn.dataset.action) return;
      if (capturingAction) {
        const prev = document.querySelector(`.key-btn[data-action="${capturingAction}"]`);
        if (prev) { prev.textContent = displayKey(shortcuts[capturingAction]); prev.classList.remove('listening'); }
      }
      capturingAction = btn.dataset.action;
      btn.classList.add('listening');
      btn.textContent = '...';
    });
  });

  // Notebook modal
  document.getElementById('nb-modal-cancel').addEventListener('click', closeNotebookModal);
  document.getElementById('nb-modal-save').addEventListener('click', saveNotebook);
  document.getElementById('notebook-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('notebook-modal')) closeNotebookModal();
  });

  // Entry modal
  document.getElementById('entry-modal-cancel').addEventListener('click', closeEntryModal);
  document.getElementById('entry-modal-save').addEventListener('click', saveEntry);
  document.getElementById('entry-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('entry-modal')) closeEntryModal();
  });

  document.getElementById('entry-img-input').addEventListener('change', async e => {
    const slots = 7 - pendingImgs.length;
    if (!slots) return;
    for (const f of Array.from(e.target.files).slice(0, slots))
      pendingImgs.push(await compressImg(f));
    renderEntryPreviews();
    e.target.value = '';
  });

  document.addEventListener('keydown', e => {
    // Key capture mode — shortcuts modal đang mở
    if (capturingAction && !document.getElementById('shortcuts-modal').classList.contains('hidden')) {
      e.preventDefault();
      const btn = document.querySelector(`.key-btn[data-action="${capturingAction}"]`);
      if (e.key !== 'Escape') {
        shortcuts[capturingAction] = e.key;
        saveShortcuts();
        if (btn) btn.textContent = displayKey(e.key);
      } else {
        if (btn) btn.textContent = displayKey(shortcuts[capturingAction]);
      }
      if (btn) btn.classList.remove('listening');
      capturingAction = null;
      return;
    }

    // Esc — đóng modal / quay lại
    if (e.key === 'Escape') {
      if (!document.getElementById('entry-modal').classList.contains('hidden'))     { closeEntryModal();    return; }
      if (!document.getElementById('notebook-modal').classList.contains('hidden'))  { closeNotebookModal(); return; }
      if (!document.getElementById('shortcuts-modal').classList.contains('hidden')) { closeShortcutsModal(); return; }
      if (!document.getElementById('settings-modal').classList.contains('hidden'))  { closeSettingsModal(); return; }
      if (document.getElementById('view-notebook').classList.contains('active'))    { closePanel(); renderMain(); goTo('view-main'); return; }
    }

    // Phím tắt điều hướng — notebook view, không đang gõ input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (!document.getElementById('view-notebook').classList.contains('active')) return;
    if (!document.getElementById('entry-modal').classList.contains('hidden')) return;
    if (e.key === shortcuts.entryOlder) navigateEntry(+1);
    else if (e.key === shortcuts.entryNewer) navigateEntry(-1);
    else if (e.key === shortcuts.imgPrev)  document.getElementById('img-prev').click();
    else if (e.key === shortcuts.imgNext)  document.getElementById('img-next').click();
  });

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
