/* TheList — views.js: all view rendering + modals */
window.TL = window.TL || {};

TL.views = (() => {
  const { $, el, escapeHtml, timeAgo, fmtDate, fmtCount, toast } = TL.util;
  const store = TL.store;

  const TYPE_ICON = {
    paper: '📄', article: '📰', video: '🎬', tweet: '🐦', repo: '📦', book: '📚', pdf: '📕',
    podcast: '🎙️', question: '❓', dataset: '🗃️', snippet: '✂️', thread: '🧵', course: '🎓',
    talk: '🎤', note: '📝', quote: '💬', conversation: '🤖', other: '🔗',
  };
  const TYPES = Object.keys(TYPE_ICON);

  /* =============== shared bits =============== */

  function tagChips(item, editable = false) {
    const wrap = el('div', { class: 'tags' });
    for (const t of item.tags || []) {
      const chip = el('span', { class: 'tag', onclick: e => { e.stopPropagation(); TL.app.filterByTag(t); } }, t);
      if (editable) {
        chip.appendChild(el('b', {
          class: 'tag-x', onclick: e => {
            e.stopPropagation();
            store.updateItem(item.id, { tags: item.tags.filter(x => x !== t) });
          }
        }, '×'));
      }
      wrap.appendChild(chip);
    }
    if (editable) {
      const inp = el('input', {
        class: 'tag-input', placeholder: '+tag',
        onkeydown: e => {
          if (e.key === 'Enter' && e.target.value.trim()) {
            store.updateItem(item.id, { tags: [...new Set([...(item.tags || []), e.target.value.trim().toLowerCase()])] });
            e.target.value = '';
          }
        }
      });
      inp.addEventListener('click', e => e.stopPropagation());
      wrap.appendChild(inp);
    }
    return wrap;
  }

  function importanceBar(item) {
    return el('div', { class: 'imp', title: 'importance ' + item.importance },
      el('div', { class: 'imp-fill', style: `width:${item.importance}%; background:${impColor(item.importance)}` }));
  }
  const impColor = v => v >= 75 ? 'var(--acc)' : v >= 50 ? 'var(--acc2)' : '#5a6478';

  function metaLine(item) {
    const bits = [];
    if (item.author) bits.push(item.author);
    if (item.domain) bits.push(item.domain);
    if (item.meta?.duration) bits.push('⏱ ' + item.meta.duration);
    if (item.meta?.stars != null) bits.push('★ ' + fmtCount(item.meta.stars));
    if (item.meta?.views != null) bits.push('▶ ' + fmtCount(item.meta.views));
    if (item.publishedAt) bits.push(fmtDate(item.publishedAt));
    return bits.join(' · ');
  }

  function card(item, opts = {}) {
    const c = el('div', { class: 'card' + (item.fetchStatus === 'pending' ? ' pending' : ''), onclick: () => openDetail(item.id) });
    if (item.thumbnail) c.appendChild(el('div', { class: 'thumb', style: `background-image:url('${item.thumbnail.replace(/'/g, '%27')}')` }));
    const body = el('div', { class: 'card-body' });
    body.appendChild(el('div', { class: 'card-top' },
      el('span', { class: 'type-badge' }, (TYPE_ICON[item.type] || '🔗') + ' ' + item.type),
      item.queued ? el('span', { class: 'queued-flag', title: 'in queue' }, '🎯') : null,
      item.readingStatus === 'done' ? el('span', { class: 'done-flag' }, '✓') : null,
      el('span', { class: 'added' }, timeAgo(item.addedAt)),
    ));
    body.appendChild(el('div', { class: 'card-title' },
      item.fetchStatus === 'pending' ? '⏳ ' : item.fetchStatus === 'failed' ? '⚠️ ' : '',
      item.title || item.url || '(untitled)'));
    const m = metaLine(item);
    if (m) body.appendChild(el('div', { class: 'card-meta' }, m));
    if (item.description && !opts.compact) body.appendChild(el('div', { class: 'card-desc' }, item.description.slice(0, 180)));
    if ((item.tags || []).length) body.appendChild(tagChips(item));
    const foot = el('div', { class: 'card-foot' },
      importanceBar(item),
      item.collection ? el('span', {
        class: 'collection-pill',
        onclick: e => { e.stopPropagation(); TL.app.filterByCollection(item.collection); }
      }, item.collection) : null,
    );
    body.appendChild(foot);
    if (opts.score != null) body.appendChild(el('div', { class: 'score-chip' }, 'match ' + (opts.score * 100 | 0) + '%'));
    c.appendChild(body);
    return c;
  }

  function grid(items, opts = {}) {
    const g = el('div', { class: 'grid' });
    if (!items.length) g.appendChild(el('div', { class: 'empty' }, opts.empty || 'Nothing here yet.'));
    for (const entry of items) {
      const item = entry.item || entry;
      g.appendChild(card(item, { ...opts, score: entry.score }));
    }
    return g;
  }

  /* =============== Inbox =============== */

  function renderInbox(root) {
    const inbox = store.active().filter(i => i.status === 'inbox');
    const pending = inbox.filter(i => i.fetchStatus === 'pending').length;
    const failed = inbox.filter(i => i.fetchStatus === 'failed').length;

    const pasteBox = el('textarea', {
      id: 'pasteBox', rows: '4',
      placeholder: 'Dump links here — one or many, any format. Tweets, papers, videos, repos, articles…\nNon-link text on a line becomes that link’s note.',
    });
    const noteBox = el('textarea', { id: 'noteBox', rows: '2', placeholder: 'Or jot a quick thought / note / idea…' });

    root.appendChild(el('section', { class: 'panel' },
      el('h2', {}, '📥 Inbox ', el('span', { class: 'sub' }, 'dump now, organize later')),
      pasteBox,
      el('div', { class: 'row' },
        el('button', { class: 'btn primary', onclick: () => TL.app.addLinks(pasteBox.value).then(() => { pasteBox.value = ''; }) }, 'Add links'),
        el('span', { class: 'hint' }, 'auto-fetches metadata · auto-categorizes · dedupes'),
      ),
      noteBox,
      el('div', { class: 'row' },
        el('button', { class: 'btn', onclick: () => { TL.app.addNote(noteBox.value); noteBox.value = ''; } }, 'Save note'),
      ),
    ));

    const header = el('div', { class: 'list-header' },
      el('h3', {}, `${inbox.length} in inbox` + (pending ? ` · ⏳ ${pending} fetching` : '') + (failed ? ` · ⚠️ ${failed} failed` : '')),
      el('div', { class: 'row' },
        failed ? el('button', { class: 'btn small', onclick: () => TL.app.retryFailed() }, '↻ Retry failed') : null,
        inbox.length ? el('button', { class: 'btn small primary', onclick: () => TL.app.acceptAll() }, '✓ Accept all → Library') : null,
      ),
    );
    root.appendChild(header);

    const list = el('div', { class: 'inbox-list' });
    for (const item of inbox.slice().reverse()) list.appendChild(inboxRow(item));
    if (!inbox.length) list.appendChild(el('div', { class: 'empty' }, 'Inbox zero. Beautiful.'));
    root.appendChild(list);
  }

  function inboxRow(item) {
    const row = el('div', { class: 'inbox-row' + (item.fetchStatus === 'pending' ? ' pending' : '') });
    const main = el('div', { class: 'inbox-main', onclick: () => openDetail(item.id) },
      el('div', { class: 'card-title' },
        (item.fetchStatus === 'pending' ? '⏳ ' : item.fetchStatus === 'failed' ? '⚠️ ' : (TYPE_ICON[item.type] || '🔗') + ' '),
        item.title || item.url),
      el('div', { class: 'card-meta' }, metaLine(item)),
      tagChips(item, true),
    );
    const typeSel = el('select', { class: 'type-select', onchange: e => store.updateItem(item.id, { type: e.target.value }) },
      ...TYPES.map(t => el('option', { value: t, ...(t === item.type ? { selected: '' } : {}) }, TYPE_ICON[t] + ' ' + t)));
    typeSel.addEventListener('click', e => e.stopPropagation());
    const colInp = el('input', {
      class: 'col-input', value: item.collection || '', placeholder: 'collection',
      onchange: e => store.updateItem(item.id, { collection: e.target.value, meta: { ...item.meta, userCollection: true } }),
    });
    const controls = el('div', { class: 'inbox-controls' },
      typeSel, colInp,
      el('button', { class: 'btn small primary', title: 'move to library', onclick: () => store.updateItem(item.id, { status: 'library' }) }, '✓ Library'),
      el('button', { class: 'btn small', title: 'library + reading queue', onclick: () => TL.app.acceptToQueue(item.id) }, '🎯 Queue'),
      el('button', { class: 'btn small danger', onclick: () => store.deleteItem(item.id) }, '🗑'),
    );
    row.appendChild(main);
    row.appendChild(controls);
    return row;
  }

  /* =============== Library =============== */

  function renderLibrary(root, f) {
    const all = store.active().filter(i => i.status === 'library' || (f.showArchived && i.status === 'archived'));
    const q = $('#q').value.trim();

    // facet values
    const collections = [...new Set(all.map(i => i.collection).filter(Boolean))].sort();
    const typesPresent = [...new Set(all.map(i => i.type))].sort();

    const bar = el('div', { class: 'filterbar' },
      sel('type', ['', ...typesPresent], f.type, v => TL.app.setFilter({ type: v }), t => t ? (TYPE_ICON[t] || '') + ' ' + t : 'all types'),
      sel('collection', ['', ...collections], f.collection, v => TL.app.setFilter({ collection: v }), c => c || 'all collections'),
      f.tag ? el('span', { class: 'tag active' }, '#' + f.tag, el('b', { class: 'tag-x', onclick: () => TL.app.setFilter({ tag: '' }) }, '×')) : null,
      el('span', { class: 'spacer' }),
      sel('sort', ['added', 'importance', 'published', 'title'], f.sort, v => TL.app.setFilter({ sort: v }), s => '↓ ' + s),
      el('label', { class: 'chk' },
        el('input', { type: 'checkbox', ...(f.showArchived ? { checked: '' } : {}), onchange: e => TL.app.setFilter({ showArchived: e.target.checked }) }),
        ' archived'),
    );
    root.appendChild(bar);

    let items;
    if (q) {
      const results = TL.search.search(q, f.searchMode, all);
      root.appendChild(el('div', { class: 'list-header' },
        el('h3', {}, `${results.length} result${results.length === 1 ? '' : 's'} for “${q}” `,
          el('span', { class: 'sub' }, f.searchMode + ' search'))));
      items = results.filter(r => matchFilters(r.item, f));
    } else {
      items = all.filter(i => matchFilters(i, f));
      sortItems(items, f.sort);
      root.appendChild(el('div', { class: 'list-header' },
        el('h3', {}, `🗄 ${items.length} item${items.length === 1 ? '' : 's'}`)));
    }
    root.appendChild(grid(items, { empty: q ? 'No matches.' : 'Library is empty — accept items from your Inbox.' }));
  }

  function sel(name, options, current, onchange, labelFn) {
    return el('select', { class: 'filter-sel', onchange: e => onchange(e.target.value) },
      ...options.map(o => el('option', { value: o, ...(o === current ? { selected: '' } : {}) }, labelFn ? labelFn(o) : o)));
  }
  function matchFilters(i, f) {
    if (f.type && i.type !== f.type) return false;
    if (f.collection && i.collection !== f.collection) return false;
    if (f.tag && !(i.tags || []).includes(f.tag)) return false;
    return true;
  }
  function sortItems(items, sort) {
    const key = {
      added: i => i.addedAt || '',
      importance: i => i.importance || 0,
      published: i => i.publishedAt || '',
      title: i => (i.title || '').toLowerCase(),
    }[sort] || (i => i.addedAt);
    items.sort((a, b) => {
      const ka = key(a), kb = key(b);
      return sort === 'title' ? (ka < kb ? -1 : 1) : (ka < kb ? 1 : -1);
    });
  }

  /* =============== Queue =============== */

  function renderQueue(root) {
    const items = store.active().filter(i => i.queued && i.status !== 'archived')
      .sort((a, b) => (a.queueRank || 0) - (b.queueRank || 0));
    root.appendChild(el('div', { class: 'list-header' },
      el('h3', {}, `🎯 Reading / Watch queue — ${items.length}`),
      el('span', { class: 'sub' }, 'your “up next”, in order')));
    const list = el('div', { class: 'queue-list' });
    items.forEach((item, idx) => {
      const row = el('div', { class: 'queue-row' },
        el('div', { class: 'queue-rank' }, String(idx + 1)),
        el('div', { class: 'queue-main', onclick: () => openDetail(item.id) },
          el('div', { class: 'card-title' }, (TYPE_ICON[item.type] || '') + ' ' + (item.title || item.url)),
          el('div', { class: 'card-meta' }, metaLine(item)),
          el('div', { class: 'progress-wrap' },
            el('input', {
              type: 'range', min: '0', max: '100', value: String(item.progress || 0), class: 'progress',
              oninput: e => { e.stopPropagation(); store.updateItemQuiet(item.id, { progress: +e.target.value, readingStatus: +e.target.value >= 100 ? 'done' : 'reading' }); },
              onchange: e => store.flush(),
              onclick: e => e.stopPropagation(),
            }),
            el('span', { class: 'progress-label' }, (item.progress || 0) + '%'),
          ),
        ),
        el('div', { class: 'queue-controls' },
          el('button', { class: 'btn small', title: 'move up', onclick: () => TL.app.moveQueue(item.id, -1) }, '↑'),
          el('button', { class: 'btn small', title: 'move down', onclick: () => TL.app.moveQueue(item.id, +1) }, '↓'),
          el('button', { class: 'btn small primary', title: 'mark done & dequeue', onclick: () => store.updateItem(item.id, { queued: false, readingStatus: 'done', progress: 100 }) }, '✓ Done'),
          el('button', { class: 'btn small', title: 'remove from queue', onclick: () => store.updateItem(item.id, { queued: false }) }, '−'),
        ),
      );
      list.appendChild(row);
    });
    if (!items.length) list.appendChild(el('div', { class: 'empty' }, 'Queue is empty — add items from the Library (open one and hit “Queue”).'));
    root.appendChild(list);
  }

  /* =============== Randoms =============== */

  function renderRandoms(root, state) {
    root.appendChild(el('div', { class: 'panel' },
      el('h2', {}, '🎲 Randoms ', el('span', { class: 'sub' }, 'resurface what you forgot you saved')),
      el('div', { class: 'row' },
        el('button', { class: 'btn primary', onclick: () => TL.app.rollCollection() }, '🎲 Random collection'),
        el('button', { class: 'btn', onclick: () => TL.app.rollItems() }, '✨ Surprise me (5 items)'),
      ),
    ));
    if (state.randomTitle) {
      root.appendChild(el('div', { class: 'list-header' }, el('h3', {}, state.randomTitle)));
      root.appendChild(grid(state.randomItems || [], { empty: 'Nothing to show.' }));
    }
  }

  /* =============== Detail modal =============== */

  function openDetail(id) {
    const item = store.getItem(id);
    if (!item) return;
    closeModal();
    const root = $('#modalRoot');

    const notesArea = el('textarea', { class: 'notes-area', rows: '4', placeholder: 'Your notes on this…' });
    notesArea.value = item.notes || '';
    const saveNotes = TL.util.debounce(() => { store.updateItemQuiet(id, { notes: notesArea.value }); store.markDirty(); }, 800);
    notesArea.addEventListener('input', saveNotes);

    const hlInput = el('textarea', { class: 'hl-input', rows: '2', placeholder: 'Paste a highlight / quote worth keeping…' });

    const impSlider = el('input', {
      type: 'range', min: '0', max: '100', value: String(item.importance),
      oninput: e => { impLabel.textContent = e.target.value; },
      onchange: e => store.updateItem(id, { importance: +e.target.value, meta: { ...item.meta, userImportance: true } }),
    });
    const impLabel = el('span', { class: 'imp-num' }, String(item.importance));

    const rel = TL.search.related(item, store.active().filter(i => i.status !== 'inbox'));
    const relCard = (i, cls) => {
      const c = el('div', { class: 'rel-card ' + cls, onclick: () => openDetail(i.id) },
        el('span', { class: 'type-badge' }, TYPE_ICON[i.type] || '🔗'),
        el('span', { class: 'rel-title' }, i.title || i.url));
      return c;
    };

    const modal = el('div', { class: 'modal-back', onclick: e => { if (e.target.classList.contains('modal-back')) closeModal(); } },
      el('div', { class: 'modal' },
        el('div', { class: 'modal-head' },
          el('span', { class: 'type-badge big' }, (TYPE_ICON[item.type] || '🔗') + ' ' + item.type),
          el('button', { class: 'btn small modal-x', onclick: closeModal }, '✕'),
        ),
        el('div', { class: 'modal-cols' },
          el('div', { class: 'modal-main' },
            el('h2', { class: 'modal-title' }, item.title || '(untitled)'),
            item.url ? el('a', { class: 'modal-url', href: item.url, target: '_blank', rel: 'noopener' }, '↗ ' + item.url.slice(0, 90)) : null,
            el('div', { class: 'card-meta' }, metaLine(item)),
            item.thumbnail ? el('img', { class: 'modal-thumb', src: item.thumbnail }) : null,
            item.description ? el('p', { class: 'modal-desc' }, item.description) : null,
            item.content ? el('details', { class: 'content-details' },
              el('summary', {}, 'Saved text (' + fmtCount(item.content.length) + ' chars)'),
              el('div', { class: 'content-text' }, item.content)) : null,
            el('h4', {}, '📝 Notes'),
            notesArea,
            el('h4', {}, '✨ Highlights'),
            el('div', { class: 'hl-list' },
              (item.highlights || []).map(h => el('div', { class: 'hl' },
                el('span', {}, h.text),
                el('b', { class: 'tag-x', onclick: () => store.updateItem(id, { highlights: item.highlights.filter(x => x.id !== h.id) }) && openDetail(id) }, '×')))),
            hlInput,
            el('button', {
              class: 'btn small', onclick: () => {
                if (!hlInput.value.trim()) return;
                store.updateItem(id, { highlights: [...(item.highlights || []), { id: TL.util.uuid(), text: hlInput.value.trim(), createdAt: TL.util.nowISO() }] });
                openDetail(id);
              }
            }, '+ Add highlight'),
          ),
          el('div', { class: 'modal-side' },
            el('h4', {}, 'Status'),
            el('div', { class: 'row wrap' },
              sel('status', ['inbox', 'library', 'archived'], item.status, v => { store.updateItem(id, { status: v }); }, s => s),
              sel('reading', ['unread', 'reading', 'done'], item.readingStatus, v => store.updateItem(id, { readingStatus: v }), s => s),
            ),
            el('button', { class: 'btn small ' + (item.queued ? '' : 'primary'), onclick: () => { TL.app.toggleQueue(id); openDetail(id); } },
              item.queued ? '− Remove from queue' : '🎯 Add to queue'),
            el('h4', {}, 'Importance'),
            el('div', { class: 'row' }, impSlider, impLabel),
            el('h4', {}, 'Collection'),
            el('input', {
              class: 'col-input wide', value: item.collection || '', placeholder: 'collection…',
              onchange: e => store.updateItem(id, { collection: e.target.value, meta: { ...item.meta, userCollection: true } }),
            }),
            el('h4', {}, 'Tags'),
            tagChips(item, true),
            (item.type === 'paper' || item.type === 'pdf' || item.meta?.pdfUrl) ? el('div', {},
              el('h4', {}, 'File'),
              item.filePath
                ? el('button', { class: 'btn small', onclick: () => TL.app.openPdf(id) }, '📕 Open saved PDF')
                : el('button', { class: 'btn small', onclick: () => TL.app.savePdf(id) }, '💾 Save PDF to library'),
            ) : null,
            el('h4', {}, '🔗 Related'),
            el('div', { class: 'rel-list' },
              rel.close.length ? rel.close.map(i => relCard(i, 'close')) : el('div', { class: 'sub' }, 'nothing similar yet'),
              rel.mid ? [el('div', { class: 'rel-label' }, 'somewhat related'), relCard(rel.mid, 'mid')] : null,
              rel.wild ? [el('div', { class: 'rel-label' }, 'wildcard 🎲'), relCard(rel.wild, 'wild')] : null,
            ),
            el('div', { class: 'modal-footer' },
              el('button', { class: 'btn small danger', onclick: () => { if (confirm('Delete this item?')) { store.deleteItem(id); closeModal(); } } }, '🗑 Delete'),
              el('span', { class: 'sub' }, 'added ' + timeAgo(item.addedAt)),
            ),
          ),
        ),
      ));
    root.appendChild(modal);
  }

  function closeModal() { $('#modalRoot').innerHTML = ''; }

  /* =============== Settings modal =============== */

  function openSettings() {
    closeModal();
    const s = store.getSettings();
    const inp = (id, value, placeholder, type = 'text') =>
      el('input', { id, class: 'set-input', value: value || '', placeholder, type, autocomplete: 'off' });

    const tokenI = inp('set-token', s.token, 'ghp_… (fine-grained PAT with Contents read/write on the data repo)', 'password');
    const repoI = inp('set-repo', s.dataRepo, 'owner/repo e.g. Verma314/TheList-data');
    const branchI = inp('set-branch', s.branch, 'main');
    const ytI = inp('set-yt', s.ytKey, 'YouTube Data API key (optional — richer video metadata)', 'password');
    const proxyI = inp('set-proxy', s.corsProxy, 'CORS proxy prefix');
    const status = el('div', { class: 'set-status' });

    const fileInp = el('input', { type: 'file', accept: '.json', style: 'display:none' });
    fileInp.addEventListener('change', async () => {
      if (!fileInp.files[0]) return;
      try {
        const n = store.importJson(await fileInp.files[0].text());
        toast('Imported/merged ' + n + ' items', 'ok');
      } catch (e) { toast('Import failed: ' + e.message, 'err'); }
    });

    const modal = el('div', { class: 'modal-back', onclick: e => { if (e.target.classList.contains('modal-back')) closeModal(); } },
      el('div', { class: 'modal narrow' },
        el('div', { class: 'modal-head' }, el('h2', {}, '⚙️ Settings'), el('button', { class: 'btn small modal-x', onclick: closeModal }, '✕')),
        el('div', { class: 'set-form' },
          el('label', {}, 'GitHub token (stored only in this browser)'), tokenI,
          el('label', {}, 'Data repo (private!)'), repoI,
          el('label', {}, 'Branch'), branchI,
          el('label', {}, 'YouTube API key'), ytI,
          el('label', {}, 'CORS proxy (for article/tweet fetching)'), proxyI,
          el('div', { class: 'row' },
            el('button', {
              class: 'btn primary', onclick: async () => {
                store.saveSettings({
                  token: tokenI.value.trim(), dataRepo: repoI.value.trim(),
                  branch: branchI.value.trim() || 'main', ytKey: ytI.value.trim(), corsProxy: proxyI.value.trim(),
                });
                status.textContent = 'Testing…';
                try {
                  status.textContent = '✓ ' + await store.testConnection();
                  store.pull();
                } catch (e) { status.textContent = '✗ ' + e.message; }
              }
            }, 'Save & test'),
            el('button', { class: 'btn', onclick: () => store.pull().then(() => toast('Pulled from GitHub', 'ok')) }, '⇣ Pull'),
            el('button', { class: 'btn', onclick: () => store.push().then(() => toast('Pushed to GitHub', 'ok')) }, '⇡ Push'),
          ),
          status,
          el('hr'),
          el('div', { class: 'row' },
            el('button', {
              class: 'btn small', onclick: () => {
                const blob = new Blob([store.exportJson()], { type: 'application/json' });
                const a = el('a', { href: URL.createObjectURL(blob), download: 'thelist-export.json' });
                a.click();
              }
            }, '⇩ Export JSON'),
            el('button', { class: 'btn small', onclick: () => fileInp.click() }, '⇧ Import JSON'),
            fileInp,
          ),
          el('p', { class: 'sub' }, 'Sync: ', el('span', {}, store.state.lastSync ? 'last synced ' + timeAgo(store.state.lastSync) : 'never'),
            store.state.lastError ? ' · last error: ' + store.state.lastError : ''),
        ),
      ));
    $('#modalRoot').appendChild(modal);
  }

  return { renderInbox, renderLibrary, renderQueue, renderRandoms, openDetail, openSettings, closeModal, TYPE_ICON };
})();
