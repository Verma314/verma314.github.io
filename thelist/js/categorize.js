/* TheList — categorize.js: auto tags, collection suggestion, importance scoring */
window.TL = window.TL || {};

TL.cat = (() => {
  const { clamp } = TL.util;

  const STOP = new Set(('a,an,the,and,or,but,if,then,else,for,of,in,on,at,to,from,by,with,about,into,over,after,' +
    'is,are,was,were,be,been,being,have,has,had,do,does,did,will,would,can,could,should,may,might,shall,must,' +
    'i,you,he,she,it,we,they,this,that,these,those,my,your,his,her,its,our,their,what,which,who,whom,how,when,' +
    'where,why,not,no,yes,so,as,than,too,very,just,also,more,most,some,any,each,other,such,only,own,same,all,' +
    'via,using,use,used,new,one,two,first,last,get,got,make,made,like,based,towards,toward,between,through,' +
    'let,lets,need,best,thing,things,really,every,much,many,still,well,even,know,see,look,https,http,www,com,' +
    'paper,article,video,post,blog,thread,part,intro,introduction,guide,tutorial,review,notes,' +
    'am,an,as,at,be,by,de,do,go,he,hi,id,ie,im,is,it,me,mr,my,no,of,ok,on,or,re,so,to,up,us,vs,we').split(','));

  function tokenize(text) {
    return String(text || '').toLowerCase()
      .replace(/[^a-z0-9+#.\- ]/g, ' ')
      .split(/\s+/)
      .map(w => w.replace(/^[.\-]+|[.\-]+$/g, ''))
      .filter(w => w.length >= 2 && !STOP.has(w) && !/^\d+$/.test(w));
  }

  // top-N keywords from an item's own text (frequency + position weighting)
  function keywords(item, n = 4) {
    const titleToks = tokenize(item.title);
    const bodyToks = tokenize((item.description || '') + ' ' + (item.tags || []).join(' '));
    const score = new Map();
    titleToks.forEach(w => score.set(w, (score.get(w) || 0) + 3));
    bodyToks.forEach(w => score.set(w, (score.get(w) || 0) + 1));
    return Array.from(score.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .filter(([, s]) => s >= 2)
      .map(([w]) => w);
  }

  const COLLECTION_RULES = [
    [['machine-learning', 'deep-learning', 'llm', 'llms', 'nlp', 'ai', 'neural', 'transformer', 'transformers',
      'reinforcement', 'rl', 'agents', 'gpt', 'diffusion', 'embedding', 'computer-vision', 'anthropic', 'openai'], 'AI & ML'],
    [['math', 'mathematics', 'theorem', 'proof', 'proofs', 'algebra', 'topology', 'lean', 'lean4', 'formal',
      'logic', 'category-theory', 'analysis', 'probability', 'statistics'], 'Math & Formal Methods'],
    [['programming', 'code', 'software', 'rust', 'python', 'javascript', 'typescript', 'compiler', 'database',
      'systems', 'linux', 'kernel', 'api', 'devops', 'algorithms', 'golang', 'c++'], 'Programming & Systems'],
    [['physics', 'quantum', 'cosmology', 'relativity', 'thermodynamics'], 'Physics'],
    [['startup', 'startups', 'business', 'product', 'economics', 'finance', 'investing', 'market'], 'Business & Econ'],
    [['philosophy', 'psychology', 'history', 'essay', 'writing', 'thinking', 'learning', 'productivity'], 'Ideas & Essays'],
    [['security', 'cryptography', 'crypto', 'exploit', 'vulnerability', 'privacy'], 'Security & Crypto'],
    [['health', 'fitness', 'nutrition', 'sleep', 'meditation'], 'Health'],
    [['neuroscience', 'biology', 'genetics', 'brain'], 'Bio & Neuro'],
  ];

  function suggestTags(item) {
    const existing = (item.tags || []).map(t => t.toLowerCase());
    const kws = keywords(item, 5).filter(k => !existing.includes(k));
    return [...new Set([...existing, ...kws])].slice(0, 6);
  }

  function suggestCollection(item, allItems) {
    // 1) vote from most-similar already-organized items
    if (TL.search && allItems.length > 5) {
      const sims = TL.search.similarTo(item, allItems.filter(i =>
        i.id !== item.id && i.collection && i.status === 'library'), 5);
      const votes = new Map();
      for (const { item: other, score } of sims) {
        if (score < 0.12) continue;
        votes.set(other.collection, (votes.get(other.collection) || 0) + score);
      }
      let best = null, bestScore = 0;
      for (const [col, sc] of votes) if (sc > bestScore) { best = col; bestScore = sc; }
      if (best && bestScore >= 0.25) return best;
    }
    // 2) rule match over tags + title tokens
    const bag = new Set([...(item.tags || []).map(t => t.toLowerCase()), ...tokenize(item.title + ' ' + item.description)]);
    let best = null, bestHits = 0;
    for (const [terms, name] of COLLECTION_RULES) {
      const hits = terms.reduce((n, t) => n + (bag.has(t) ? 1 : 0), 0);
      if (hits > bestHits) { bestHits = hits; best = name; }
    }
    if (best) return best;
    // 3) fallback by type
    const typeMap = { paper: 'Papers', book: 'Books', video: 'Watch', course: 'Watch', podcast: 'Listen', note: 'Notes', quote: 'Quotes' };
    return typeMap[item.type] || 'Unsorted';
  }

  const TYPE_BASE = {
    paper: 65, book: 70, course: 62, talk: 55, video: 45, article: 50, repo: 55, dataset: 50,
    pdf: 55, podcast: 45, tweet: 30, question: 40, note: 42, snippet: 35, thread: 38,
    quote: 28, conversation: 40, other: 40,
  };
  const QUALITY_DOMAINS = ['arxiv.org', 'distill.pub', 'openreview.net', 'nature.com', 'science.org',
    'acm.org', 'lesswrong.com', 'gwern.net', 'paulgraham.com', 'karpathy.ai', 'colah.github.io'];

  function scoreImportance(item) {
    let s = TYPE_BASE[item.type] ?? 40;
    const m = item.meta || {};
    if (m.stars) s += clamp(Math.log10(Number(m.stars) + 1) * 3.5, 0, 15);
    if (m.views) s += clamp(Math.log10(Number(m.views) + 1) - 3, 0, 8);
    if (m.score) s += clamp(Math.log10(Number(m.score) + 1) * 4, 0, 10);
    if (QUALITY_DOMAINS.includes(item.domain)) s += 6;
    if (item.publishedAt && (Date.now() - new Date(item.publishedAt)) < 90 * 86400e3) s += 4;
    if ((item.description || '').length > 400) s += 3;
    if (item.filePath) s += 3;
    return clamp(Math.round(s), 5, 95);
  }

  /* fill in tags / collection / importance without stomping on user edits */
  function categorize(item, allItems) {
    item.tags = suggestTags(item);
    if (!item.meta.userCollection) item.collection = suggestCollection(item, allItems || []);
    if (!item.meta.userImportance) item.importance = scoreImportance(item);
    return item;
  }

  return { categorize, suggestTags, suggestCollection, scoreImportance, keywords, tokenize, COLLECTION_RULES };
})();
