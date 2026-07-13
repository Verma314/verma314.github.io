/* TheList — app.js: boot, routing, actions */
window.TL = window.TL || {};

TL.app = (() => {
  const { $, $$, el, toast, canonicalUrl, domainOf, extractUrls, debounce } = TL.util;
  const store = TL.store;

  const state = {
    view: 'inbox',
    filters: { type: '', collection: '', tag: '', sort: 'added', searchMode: 'both', showArchived: false },
    randomTitle: '', randomItems: [],
  };

  /* ---------- render ---------- */
  function render() {
    const root = $('#view');
    root.innerHTML = '';
    if (state.view === 'inbox') TL.views.renderInbox(root);
    else if (state.view === 'library') TL.views.renderLibrary(root, state.filters);
    else if (state.view === 'queue') TL.views.renderQueue(root);
    else if (state.view === 'randoms') TL.views.renderRandoms(root, state);
    renderCounts();
    renderNav();
    renderBanner(root);
  }
  function renderCounts() {
    const act = store.active();
    const inbox = act.filter(i => i.status === 'inbox').length;
    const queued = act.filter(i => i.queued && i.status !== 'archived').length;
    $('#inboxCount').textContent = inbox || '';
    $('#queueCount').textContent = queued || '';
  }
  function renderNav() {
    $$('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.view === state.view));
  }
  function renderBanner(root) {
    if (!store.getSettings().token && !localStorage.getItem('tl_dismissed_banner')) {
      root.prepend(el('div', { class: 'banner' },
        '💾 Local-only mode — your library lives in this browser. Connect GitHub in ',
        el('a', { href: '#', onclick: e => { e.preventDefault(); TL.views.openSettings(); } }, '⚙ Settings'),
        ' to sync across devices. ',
        el('b', { class: 'tag-x', onclick: () => { localStorage.setItem('tl_dismissed_banner', '1'); render(); } }, '×')));
    }
  }
  function renderSync() {
    const s = store.state.syncStatus;
    const dot = $('#syncDot');
    dot.className = 'sync-dot ' + s;
    $('#syncLabel').textContent = { local: 'local', syncing: 'syncing…', synced: 'synced', dirty: 'unsaved', error: 'sync error' }[s] || s;
    $('#syncLabel').title = store.state.lastError || '';
  }

  function go(view) {
    state.view = view;
    render();
  }

  /* ---------- actions ---------- */
  async function addLinks(text) {
    if (!text.trim()) return;
    const existing = new Set(store.active().map(i => i.canonicalUrl).filter(Boolean));
    const items = [];
    let dupes = 0, seen = new Set();
    for (const line of text.split('\n')) {
      const urls = extractUrls(line);
      const note = line.replace(/https?:\/\/[^\s]+/g, '').trim();
      for (const url of urls) {
        const canon = canonicalUrl(url);
        if (existing.has(canon) || seen.has(canon)) { dupes++; continue; }
        seen.add(canon);
        items.push(store.newItem({
          url, canonicalUrl: canon, domain: domainOf(canon),
          type: TL.fetchers.detectType(canon),
          title: url, notes: note || '',
          source: 'paste',
        }));
      }
    }
    if (!items.length) {
      toast(dupes ? `All ${dupes} link(s) already in your library` : 'No links found — use the note box for plain text', 'warn');
      return;
    }
    store.addItems(items);
    toast(`Added ${items.length} link${items.length > 1 ? 's' : ''}` + (dupes ? ` (${dupes} duplicate${dupes > 1 ? 's' : ''} skipped)` : ''), 'ok');
    const rerender = debounce(() => { if (state.view === 'inbox') render(); }, 400);
    await TL.fetchers.enrichAll(items, rerender);
  }

  function addNote(text) {
    if (!text.trim()) return;
    const lines = text.trim().split('\n');
    const item = store.newItem({
      type: 'note', title: lines[0].slice(0, 120),
      description: lines.slice(1).join('\n').slice(0, 2000),
      content: text.trim(), fetchStatus: 'done', source: 'note',
    });
    TL.cat.categorize(item, store.active());
    store.addItems([item]);
    toast('Note saved to inbox', 'ok');
  }

  function acceptAll() {
    const inbox = store.active().filter(i => i.status === 'inbox' && i.fetchStatus !== 'pending');
    for (const it of inbox) store.updateItemQuiet(it.id, { status: 'library' });
    store.flush();
    toast(`Moved ${inbox.length} items to Library`, 'ok');
  }

  function acceptToQueue(id) {
    const max = Math.max(0, ...store.active().filter(i => i.queued).map(i => i.queueRank || 0));
    store.updateItem(id, { status: 'library', queued: true, queueRank: max + 1 });
  }

  function toggleQueue(id) {
    const it = store.getItem(id);
    if (!it) return;
    if (it.queued) store.updateItem(id, { queued: false });
    else {
      const max = Math.max(0, ...store.active().filter(i => i.queued).map(i => i.queueRank || 0));
      store.updateItem(id, { queued: true, queueRank: max + 1, status: it.status === 'inbox' ? 'library' : it.status });
    }
  }

  function moveQueue(id, dir) {
    const items = store.active().filter(i => i.queued).sort((a, b) => (a.queueRank || 0) - (b.queueRank || 0));
    const idx = items.findIndex(i => i.id === id);
    const swap = items[idx + dir];
    if (!swap) return;
    const a = items[idx].queueRank || idx, b = swap.queueRank || idx + dir;
    store.updateItemQuiet(id, { queueRank: b });
    store.updateItemQuiet(swap.id, { queueRank: a });
    store.flush();
  }

  async function retryFailed() {
    const failed = store.active().filter(i => i.status === 'inbox' && i.fetchStatus === 'failed');
    failed.forEach(i => store.updateItemQuiet(i.id, { fetchStatus: 'pending' }));
    store.flush();
    await TL.fetchers.enrichAll(failed, debounce(() => render(), 400));
  }

  function rollCollection() {
    const items = store.active().filter(i => i.status === 'library' && i.collection);
    const cols = [...new Set(items.map(i => i.collection))];
    if (!cols.length) { toast('No collections yet — accept some items first', 'warn'); return; }
    const col = cols[Math.floor(Math.random() * cols.length)];
    state.randomTitle = '🎲 Collection: ' + col;
    state.randomItems = items.filter(i => i.collection === col);
    render();
  }
  function rollItems() {
    const items = store.active().filter(i => i.status === 'library');
    if (!items.length) { toast('Library is empty', 'warn'); return; }
    const shuffled = items.slice().sort(() => Math.random() - 0.5);
    state.randomTitle = '✨ Five from the vault';
    state.randomItems = shuffled.slice(0, 5);
    render();
  }

  async function savePdf(id) {
    const it = store.getItem(id);
    toast('Fetching & saving PDF…');
    try {
      await TL.fetchers.downloadPdf(it);
      toast('PDF saved to data repo ✓', 'ok');
      TL.views.openDetail(id);
    } catch (e) { toast('PDF save failed: ' + e.message, 'err'); }
  }
  async function openPdf(id) {
    const it = store.getItem(id);
    try {
      const url = await store.openRepoFile(it.filePath);
      window.open(url, '_blank');
    } catch (e) { toast('Could not open: ' + e.message, 'err'); }
  }

  function filterByTag(tag) {
    state.filters.tag = tag;
    go('library');
  }
  function filterByCollection(col) {
    state.filters.collection = col;
    go('library');
  }
  function setFilter(patch) {
    Object.assign(state.filters, patch);
    render();
  }

  /* ---------- boot ---------- */
  function boot() {
    store.loadSettings();
    store.loadCache();

    $$('.tabs button').forEach(b => b.addEventListener('click', () => go(b.dataset.view)));
    $('#btnSettings').addEventListener('click', TL.views.openSettings);
    $('#q').addEventListener('input', debounce(() => {
      if (state.view !== 'library') state.view = 'library';
      render();
    }, 250));
    $('#searchMode').addEventListener('change', e => setFilter({ searchMode: e.target.value }));
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') TL.views.closeModal();
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault(); $('#q').focus();
      }
    });

    store.onChange(what => {
      if (what === 'items') { TL.search.markDirty(); render(); }
      if (what === 'sync') renderSync();
    });

    render();
    renderSync();
    store.pull().then(() => {
      // resume enrichment for anything left pending by a previous session
      const stuck = store.active().filter(i => i.fetchStatus === 'pending' && i.url);
      if (stuck.length) TL.fetchers.enrichAll(stuck, debounce(() => render(), 500));
    });
  }

  document.addEventListener('DOMContentLoaded', boot);

  return {
    addLinks, addNote, acceptAll, acceptToQueue, toggleQueue, moveQueue, retryFailed,
    rollCollection, rollItems, savePdf, openPdf,
    filterByTag, filterByCollection, setFilter, go, render,
  };
})();
