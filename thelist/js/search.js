/* TheList — search.js: keyword search, TF-IDF semantic similarity, related items */
window.TL = window.TL || {};

TL.search = (() => {
  const { tokenize } = TL.cat;

  /* ---------- TF-IDF index (rebuilt lazily when items change) ---------- */
  let index = null;   // { vectors: Map<id, Map<term,w>>, df: Map<term,n>, n }
  let dirty = true;
  const markDirty = () => { dirty = true; };

  function docTokens(item) {
    // weighted bag-of-words: title counts triple, tags double
    const toks = [];
    const push = (text, w) => { const t = tokenize(text); for (let i = 0; i < w; i++) toks.push(...t); };
    push(item.title, 3);
    push((item.tags || []).join(' '), 2);
    push(item.description, 1);
    push((item.content || '').slice(0, 2000), 1);
    push(item.author, 1);
    push(item.collection, 1);
    push(item.notes, 1);
    return toks;
  }

  function buildIndex(items) {
    const df = new Map();
    const tf = new Map();
    for (const it of items) {
      const counts = new Map();
      for (const t of docTokens(it)) counts.set(t, (counts.get(t) || 0) + 1);
      tf.set(it.id, counts);
      for (const t of counts.keys()) df.set(t, (df.get(t) || 0) + 1);
    }
    const n = items.length || 1;
    const vectors = new Map();
    for (const [id, counts] of tf) {
      const vec = new Map();
      let norm = 0;
      for (const [t, c] of counts) {
        const w = (1 + Math.log(c)) * Math.log(1 + n / (df.get(t) || 1));
        vec.set(t, w);
        norm += w * w;
      }
      norm = Math.sqrt(norm) || 1;
      for (const [t, w] of vec) vec.set(t, w / norm);
      vectors.set(id, vec);
    }
    index = { vectors, df, n };
    dirty = false;
  }

  function ensureIndex(items) {
    if (dirty || !index) buildIndex(items);
  }

  function cosine(a, b) {
    let s = 0;
    const [small, big] = a.size < b.size ? [a, b] : [b, a];
    for (const [t, w] of small) {
      const w2 = big.get(t);
      if (w2) s += w * w2;
    }
    return s;
  }

  function queryVector(q) {
    const counts = new Map();
    for (const t of tokenize(q)) counts.set(t, (counts.get(t) || 0) + 1);
    const vec = new Map();
    let norm = 0;
    for (const [t, c] of counts) {
      const w = (1 + Math.log(c)) * Math.log(1 + index.n / (index.df.get(t) || 1));
      vec.set(t, w);
      norm += w * w;
    }
    norm = Math.sqrt(norm) || 1;
    for (const [t, w] of vec) vec.set(t, w / norm);
    return vec;
  }

  /* ---------- public search ---------- */
  function semantic(q, items, limit = 50) {
    ensureIndex(items);
    const qv = queryVector(q);
    const out = [];
    for (const it of items) {
      const v = index.vectors.get(it.id);
      if (!v) continue;
      const s = cosine(qv, v);
      if (s > 0.03) out.push({ item: it, score: s });
    }
    out.sort((a, b) => b.score - a.score);
    return out.slice(0, limit);
  }

  function keyword(q, items, limit = 50) {
    const toks = tokenize(q);
    const qLower = q.toLowerCase().trim();
    if (!toks.length && !qLower) return [];
    const out = [];
    for (const it of items) {
      const title = (it.title || '').toLowerCase();
      const desc = ((it.description || '') + ' ' + (it.content || '').slice(0, 3000)).toLowerCase();
      const tags = (it.tags || []).join(' ').toLowerCase();
      const other = ((it.author || '') + ' ' + (it.collection || '') + ' ' + (it.notes || '') + ' ' + (it.domain || '')).toLowerCase();
      let s = 0;
      if (qLower.length > 3 && title.includes(qLower)) s += 8;
      for (const t of toks) {
        if (title.includes(t)) s += 4;
        if (tags.includes(t)) s += 3;
        if (other.includes(t)) s += 2;
        if (desc.includes(t)) s += 1;
      }
      if (s > 0) out.push({ item: it, score: s });
    }
    out.sort((a, b) => b.score - a.score || b.item.importance - a.item.importance);
    return out.slice(0, limit);
  }

  function search(q, mode, items, limit = 50) {
    if (!q.trim()) return [];
    if (mode === 'keyword') return keyword(q, items, limit);
    if (mode === 'semantic') return semantic(q, items, limit);
    // both: merge, normalizing each score list to 0..1
    const merge = new Map();
    for (const list of [keyword(q, items, limit), semantic(q, items, limit)]) {
      const max = list.length ? list[0].score : 1;
      for (const { item, score } of list) {
        const norm = score / (max || 1);
        merge.set(item.id, { item, score: Math.max(merge.get(item.id)?.score || 0, norm) + (merge.has(item.id) ? 0.15 : 0) });
      }
    }
    return Array.from(merge.values()).sort((a, b) => b.score - a.score).slice(0, limit);
  }

  /* similarity of one item against a candidate pool */
  function similarTo(item, pool, limit = 10) {
    const all = TL.store.active();
    ensureIndex(all);
    let v = index.vectors.get(item.id);
    if (!v) {
      // item not yet in index (mid-enrichment): build a throwaway vector
      const counts = new Map();
      for (const t of docTokens(item)) counts.set(t, (counts.get(t) || 0) + 1);
      v = new Map();
      let norm = 0;
      for (const [t, c] of counts) {
        const w = (1 + Math.log(c)) * Math.log(1 + index.n / (index.df.get(t) || 1));
        v.set(t, w); norm += w * w;
      }
      norm = Math.sqrt(norm) || 1;
      for (const [t, w] of v) v.set(t, w / norm);
    }
    const out = [];
    for (const other of pool) {
      if (other.id === item.id) continue;
      const ov = index.vectors.get(other.id);
      if (!ov) continue;
      out.push({ item: other, score: cosine(v, ov) });
    }
    out.sort((a, b) => b.score - a.score);
    return out.slice(0, limit);
  }

  /* Related panel: 3 close matches, 1 somewhat-related (mid-band), 1 pure wildcard */
  function related(item, items) {
    const pool = items.filter(i => i.id !== item.id && i.status !== 'archived');
    if (!pool.length) return { close: [], mid: null, wild: null };
    const ranked = similarTo(item, pool, pool.length);
    const close = ranked.slice(0, 3).filter(r => r.score > 0.02).map(r => r.item);
    const used = new Set([item.id, ...close.map(i => i.id)]);

    let mid = null;
    const rest = ranked.slice(3).filter(r => r.score > 0.008 && !used.has(r.item.id));
    if (rest.length) {
      mid = rest[Math.floor(rest.length * 0.4)].item; // deep enough to surprise, close enough to rhyme
      used.add(mid.id);
    }

    let wild = null;
    const wildPool = pool.filter(i => !used.has(i.id));
    if (wildPool.length) wild = wildPool[Math.floor(Math.random() * wildPool.length)];

    return { close, mid, wild };
  }

  return { search, semantic, keyword, similarTo, related, markDirty };
})();
