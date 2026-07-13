/* TheList — fetchers.js: type detection + metadata enrichment pipeline.
   Everything runs in the browser; CORS-blocked sources go through a configurable proxy. */
window.TL = window.TL || {};

TL.fetchers = (() => {
  const { canonicalUrl, domainOf, fmtDuration } = TL.util;

  const PROXIES = [
    u => (TL.store.getSettings().corsProxy || 'https://api.allorigins.win/raw?url=') + encodeURIComponent(u),
    u => 'https://corsproxy.io/?url=' + encodeURIComponent(u),
  ];

  async function fetchTextSmart(url, { direct = true, timeout = 15000 } = {}) {
    const attempts = [];
    if (direct) attempts.push(url);
    for (const p of PROXIES) attempts.push(p(url));
    let lastErr;
    for (const target of attempts) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), timeout);
        const res = await fetch(target, { signal: ctrl.signal });
        clearTimeout(t);
        if (!res.ok) { lastErr = new Error('HTTP ' + res.status); continue; }
        return await res.text();
      } catch (e) { lastErr = e; }
    }
    throw lastErr || new Error('fetch failed');
  }
  async function fetchJsonSmart(url, opts) {
    return JSON.parse(await fetchTextSmart(url, opts));
  }
  async function fetchBytesSmart(url, { direct = true } = {}) {
    const attempts = [];
    if (direct) attempts.push(url);
    for (const p of PROXIES) attempts.push(p(url));
    let lastErr;
    for (const target of attempts) {
      try {
        const res = await fetch(target);
        if (!res.ok) { lastErr = new Error('HTTP ' + res.status); continue; }
        return new Uint8Array(await res.arrayBuffer());
      } catch (e) { lastErr = e; }
    }
    throw lastErr || new Error('fetch failed');
  }

  /* ---------- URL classification ---------- */
  function detectType(url) {
    const d = domainOf(url);
    let path = '';
    try { path = new URL(url).pathname; } catch { }

    if (/(^|\.)arxiv\.org$/.test(d) || d === 'openreview.net' || d === 'aclanthology.org' ||
      d === 'semanticscholar.org' || /(^|\.)biorxiv\.org$/.test(d) || d === 'eprint.iacr.org') return 'paper';
    if (/\.pdf($|\?)/i.test(url)) return 'pdf';
    if (d === 'youtube.com' || d === 'youtu.be') {
      if (/[?&]list=/.test(url) && !/[?&]v=/.test(url)) return 'course';
      return 'video';
    }
    if (d === 'vimeo.com') return 'video';
    if (d === 'x.com' || d === 'twitter.com') return /\/status\/\d+/.test(path) ? 'tweet' : 'other';
    if (d === 'gist.github.com') return 'snippet';
    if (d === 'github.com') {
      const parts = path.split('/').filter(Boolean);
      const reserved = ['topics', 'search', 'orgs', 'marketplace', 'settings', 'explore', 'trending', 'sponsors', 'features'];
      if (parts.length >= 2 && !reserved.includes(parts[0])) return 'repo';
      return 'other';
    }
    if (/stackoverflow\.com|stackexchange\.com|superuser\.com|serverfault\.com/.test(d) && /\/questions\//.test(path)) return 'question';
    if ((d === 'huggingface.co' && path.startsWith('/datasets')) || (d === 'kaggle.com' && /\/datasets?\//.test(path))) return 'dataset';
    if ((d === 'open.spotify.com' && /\/(episode|show)\//.test(path)) || d === 'podcasts.apple.com') return 'podcast';
    if (d === 'goodreads.com' && /\/book\//.test(path)) return 'book';
    if (d === 'news.ycombinator.com') return 'thread';
    if (d === 'chatgpt.com' || d === 'chat.openai.com' || (d === 'claude.ai' && /share/.test(path)) || d === 'g.co' || d === 'gemini.google.com') return 'conversation';
    if (d === 'leanprover-community.github.io' || d === 'leanprover.github.io') return 'article';
    return 'article';
  }

  /* ---------- per-source extractors ---------- */
  const arxivId = url => {
    const m = url.match(/arxiv\.org\/(?:abs|pdf|html)\/(.+?)(?:v\d+)?(?:\.pdf)?\/?$/i);
    return m ? m[1] : null;
  };
  const ytVideoId = url => {
    let m = url.match(/[?&]v=([\w-]{6,})/) || url.match(/youtu\.be\/([\w-]{6,})/) ||
      url.match(/youtube\.com\/(?:shorts|live|embed)\/([\w-]{6,})/);
    return m ? m[1] : null;
  };
  const ytPlaylistId = url => {
    const m = url.match(/[?&]list=([\w-]+)/);
    return m ? m[1] : null;
  };

  const ARXIV_CATS = {
    'cs.LG': 'machine-learning', 'stat.ML': 'machine-learning', 'cs.CL': 'nlp', 'cs.CV': 'computer-vision',
    'cs.AI': 'ai', 'cs.NE': 'neural-networks', 'cs.RO': 'robotics', 'cs.CR': 'security', 'cs.DS': 'algorithms',
    'cs.DC': 'distributed-systems', 'cs.PL': 'programming-languages', 'cs.LO': 'logic', 'cs.IT': 'information-theory',
    'quant-ph': 'quantum', 'math.OC': 'optimization', 'math.PR': 'probability', 'math.ST': 'statistics',
    'econ.TH': 'economics', 'q-bio.NC': 'neuroscience',
  };

  async function enrichArxiv(item) {
    const id = arxivId(item.url) || arxivId(item.canonicalUrl);
    if (!id) return enrichGeneric(item);
    const xml = await fetchTextSmart(`https://export.arxiv.org/api/query?id_list=${encodeURIComponent(id)}`);
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    const entry = doc.querySelector('entry');
    if (!entry) throw new Error('arXiv entry not found');
    const get = sel => (entry.querySelector(sel)?.textContent || '').trim();
    item.title = get('title').replace(/\s+/g, ' ');
    item.description = get('summary').replace(/\s+/g, ' ').slice(0, 1200);
    item.author = Array.from(entry.querySelectorAll('author > name')).map(n => n.textContent).slice(0, 6).join(', ');
    item.publishedAt = get('published');
    const cats = Array.from(entry.querySelectorAll('category')).map(c => c.getAttribute('term'));
    item.meta.arxivId = id;
    item.meta.categories = cats;
    item.meta.pdfUrl = `https://arxiv.org/pdf/${id}`;
    item.tags = [...new Set(cats.map(c => ARXIV_CATS[c]).filter(Boolean))];
    if (!item.tags.length && cats[0]) item.tags = [cats[0].toLowerCase()];
  }

  async function enrichYoutube(item) {
    const vid = ytVideoId(item.url);
    const key = TL.store.getSettings().ytKey;
    if (vid && key) {
      const j = await fetchJsonSmart(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${vid}&key=${key}`);
      const v = j.items && j.items[0];
      if (v) {
        item.title = v.snippet.title;
        item.author = v.snippet.channelTitle;
        item.description = (v.snippet.description || '').slice(0, 800);
        item.publishedAt = v.snippet.publishedAt;
        item.thumbnail = (v.snippet.thumbnails.medium || v.snippet.thumbnails.default || {}).url || '';
        item.meta.duration = fmtDuration(v.contentDetails.duration);
        item.meta.views = v.statistics.viewCount;
        item.meta.videoId = vid;
        const ytTags = (v.snippet.tags || []).slice(0, 4).map(t => t.toLowerCase().replace(/\s+/g, '-'));
        item.tags = [...new Set(ytTags)];
        return;
      }
    }
    const pl = ytPlaylistId(item.url);
    if (pl && key && !vid) {
      const j = await fetchJsonSmart(
        `https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&id=${pl}&key=${key}`);
      const p = j.items && j.items[0];
      if (p) {
        item.title = p.snippet.title + ' (playlist)';
        item.author = p.snippet.channelTitle;
        item.description = (p.snippet.description || '').slice(0, 800);
        item.thumbnail = (p.snippet.thumbnails.medium || {}).url || '';
        item.meta.videoCount = p.contentDetails.itemCount;
        return;
      }
    }
    // no key / lookup failed → oEmbed (title + channel only)
    const j = await fetchJsonSmart(`https://www.youtube.com/oembed?url=${encodeURIComponent(item.url)}&format=json`, { direct: false });
    item.title = j.title;
    item.author = j.author_name;
    item.thumbnail = j.thumbnail_url || '';
  }

  async function enrichGithub(item) {
    const m = item.url.match(/github\.com\/([\w.-]+)\/([\w.-]+)/);
    if (!m) return enrichGeneric(item);
    const [, owner, repo] = m;
    const headers = {};
    const tok = TL.store.getSettings().token;
    if (tok) headers['Authorization'] = 'token ' + tok;
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo.replace(/\.git$/, '')}`, { headers });
    if (!res.ok) throw new Error('GitHub API ' + res.status);
    const j = await res.json();
    item.title = j.full_name;
    item.description = j.description || '';
    item.author = j.owner.login;
    item.publishedAt = j.created_at;
    item.meta.stars = j.stargazers_count;
    item.meta.language = j.language;
    item.meta.lastPush = j.pushed_at;
    item.tags = [...new Set([...(j.topics || []).slice(0, 4), j.language].filter(Boolean).map(t => String(t).toLowerCase()))];
  }

  async function enrichTweet(item) {
    const url = item.canonicalUrl.replace('x.com', 'twitter.com');
    const j = await fetchJsonSmart(`https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}&omit_script=1&hide_thread=1`, { direct: false });
    const div = document.createElement('div');
    div.innerHTML = j.html || '';
    const text = (div.textContent || '').replace(/\s+/g, ' ').trim();
    item.author = j.author_name || '';
    item.description = text.slice(0, 500);
    item.title = (item.author ? item.author + ': ' : '') + text.slice(0, 90) + (text.length > 90 ? '…' : '');
  }

  async function enrichStackOverflow(item) {
    const m = item.url.match(/\/questions\/(\d+)/);
    if (!m) return enrichGeneric(item);
    const site = domainOf(item.url).split('.')[0];
    const j = await fetchJsonSmart(`https://api.stackexchange.com/2.3/questions/${m[1]}?site=${site}&order=desc&sort=activity`);
    const q = j.items && j.items[0];
    if (!q) throw new Error('question not found');
    const ta = document.createElement('textarea'); ta.innerHTML = q.title;
    item.title = ta.value;
    item.tags = (q.tags || []).slice(0, 5);
    item.meta.score = q.score;
    item.meta.answers = q.answer_count;
    item.publishedAt = new Date(q.creation_date * 1000).toISOString();
  }

  async function enrichGeneric(item) {
    const html = await fetchTextSmart(item.url, { direct: false });
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const meta = (name) =>
      doc.querySelector(`meta[property="${name}"]`)?.getAttribute('content') ||
      doc.querySelector(`meta[name="${name}"]`)?.getAttribute('content') || '';

    item.title = (meta('og:title') || doc.querySelector('title')?.textContent || item.url).trim().slice(0, 200);
    item.description = (meta('og:description') || meta('description') || '').trim().slice(0, 800);
    item.thumbnail = meta('og:image') || '';
    item.author = meta('author') || meta('article:author') || '';
    item.publishedAt = meta('article:published_time') || meta('og:updated_time') || '';
    if (meta('og:type') === 'video' || meta('og:video')) item.type = 'video';

    // readable-text extraction for search + reading view
    for (const sel of ['script', 'style', 'nav', 'header', 'footer', 'aside', 'form', 'noscript', 'svg', 'iframe'])
      doc.querySelectorAll(sel).forEach(n => n.remove());
    const root = doc.querySelector('article') || doc.querySelector('main') || doc.body;
    const paras = Array.from(root?.querySelectorAll('p, li, pre, h1, h2, h3') || [])
      .map(p => p.textContent.replace(/\s+/g, ' ').trim())
      .filter(t => t.length > 40);
    const fullText = paras.join('\n\n');
    item.content = fullText.slice(0, 6000);
    if (!item.description && fullText) item.description = fullText.slice(0, 400);
    // archive full text into the data repo, best-effort, in the background
    if (fullText.length > 1500) {
      TL.store.saveContentFile(item, fullText.slice(0, 200000)).then(ok => {
        if (ok) TL.store.updateItemQuiet(item.id, { meta: { ...item.meta, contentPath: `content/${item.id}.md` } });
      });
    }
  }

  async function enrichPdfUrl(item) {
    try { await enrichGeneric(item); } catch { /* many PDF urls have no html page */ }
    if (!item.title || item.title === item.url) {
      const name = decodeURIComponent(item.url.split('/').pop().split('?')[0]).replace(/[-_]/g, ' ').replace(/\.pdf$/i, '');
      item.title = name || item.url;
    }
    item.meta.pdfUrl = item.url;
  }

  /* ---------- pipeline ---------- */
  async function enrich(item) {
    try {
      const d = domainOf(item.url);
      if (item.type === 'paper' && /arxiv/.test(d)) await enrichArxiv(item);
      else if ((item.type === 'video' || item.type === 'course') && /youtu/.test(d)) await enrichYoutube(item);
      else if (item.type === 'repo') await enrichGithub(item);
      else if (item.type === 'tweet') await enrichTweet(item);
      else if (item.type === 'question') await enrichStackOverflow(item);
      else if (item.type === 'pdf') await enrichPdfUrl(item);
      else if (item.url) await enrichGeneric(item);
      item.fetchStatus = 'done';
    } catch (e) {
      console.warn('enrich failed', item.url, e);
      if (!item.title) item.title = item.url;
      item.fetchStatus = 'failed';
    }
    return item;
  }

  // enrich many with limited concurrency; onEach fires after each item completes
  async function enrichAll(items, onEach) {
    const queue = [...items];
    const workers = Array.from({ length: 3 }, async () => {
      while (queue.length) {
        const item = queue.shift();
        await enrich(item);
        TL.cat.categorize(item, TL.store.active());
        TL.store.updateItemQuiet(item.id, item);
        if (onEach) onEach(item);
      }
    });
    await Promise.all(workers);
    TL.store.flush();
  }

  async function downloadPdf(item) {
    const url = item.meta.pdfUrl || item.url;
    const bytes = await fetchBytesSmart(url);
    if (bytes.length > 60 * 1024 * 1024) throw new Error('PDF too large for the GitHub contents API (>60MB)');
    const path = await TL.store.savePdfFile(item, bytes);
    TL.store.updateItem(item.id, { filePath: path });
    return path;
  }

  return { detectType, enrich, enrichAll, downloadPdf, fetchTextSmart, fetchJsonSmart, canonicalUrl };
})();
