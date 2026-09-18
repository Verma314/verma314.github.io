/**
 * Blog-by-email → GitHub Pages
 * ----------------------------------------------------------------------------
 * Watches Gmail for messages whose subject looks like:
 *
 *     {BLOG} My Post Title
 *     {BLOG:secret} My Post Title      (if a secret keyword is configured)
 *
 * ...and publishes the plain-text body as a new Jekyll post in
 * verma314/verma314.github.io under _blog/, mirroring your local `blog` alias.
 *
 * REPLIES APPEND. Once a thread has been published, any later reply you send
 * (from an allowed sender) is appended to the SAME post file — separated by a
 * blank line, with Gmail's quoted "On ... wrote:" history stripped off.
 *
 * IDEMPOTENCY. State is tracked per-thread in Script Properties:
 * a thread creates exactly one post (from its first {BLOG} message) and each
 * message is processed exactly once, so replying can never mint duplicate
 * posts. Runs on a 1-minute time trigger. One-time setup: see README.md.
 */

// ---- Config -----------------------------------------------------------------
const CONFIG = {
  // GitHub repo that hosts the Jekyll site.
  owner: 'verma314',
  repo: 'verma314.github.io',
  branch: 'master',
  postsDir: '_blog',
  categories: 'books',            // matches your existing front-matter
  timezone: 'Europe/London',      // controls the +0100 / +0000 offset in `date:`

  // SECURITY GUARD — only these senders may publish OR append. "Email to self"
  // means your own address(es). Add every address you might send from. Matching
  // is case-insensitive and checks only the address portion of the From: header.
  allowedSenders: [
    'asverma314@gmail.com',
    'enjoy.your.solitude@gmail.com',
    'a.verma1024@gmail.com',
    'adityasinghverma314@gmail.com',
  ],

  // Optional extra guard. If non-empty, the subject MUST be {BLOG:keyword} title
  // and the keyword must match. Leave '' to rely on the sender allow-list alone.
  // (Only the FIRST {BLOG} message needs the keyword; replies don't.)
  secretKeyword: '',

  // Gmail labels. `doneLabel` marks a thread as "post created"; `errorLabel`
  // parks a thread that failed so it isn't retried in a loop.
  doneLabel: 'blogged',
  errorLabel: 'blog-error',

  // Two searches, unioned each run:
  //   queryNew     — unblogged threads → create a post
  //   queryReplies — already-blogged threads with an UNREAD message → append
  // Splitting them (instead of one OR query) keeps the Gmail search simple and
  // robust, and steady-state runs return nothing (everything is read+blogged).
  queryNew:     'subject:BLOG newer_than:7d -label:blogged -label:blog-error',
  queryReplies: 'subject:BLOG newer_than:7d label:blogged is:unread -label:blog-error',
};

// Subject must look like:  {BLOG} My Title   or   {BLOG:secret} My Title
const SUBJECT_RE = /^\s*\{BLOG(?::([^}]*))?\}\s*(.+?)\s*$/i;

// Per-thread state lives in Script Properties under this prefix. Value is JSON:
//   { path: '_blog/2026-...-Title.markdown', n: <messages processed so far> }
const STATE_PREFIX = 'thread:';

// ---- Entry point (runs on the 1-minute trigger) -----------------------------
function processBlogEmails() {
  const token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) throw new Error('Missing GITHUB_TOKEN script property. See README.');

  const done = getOrCreateLabel_(CONFIG.doneLabel);
  const err = getOrCreateLabel_(CONFIG.errorLabel);

  // Union the two searches, de-duped by thread id (a thread can match both).
  const seen = {};
  const threads = [];
  [CONFIG.queryNew, CONFIG.queryReplies].forEach(function (q) {
    GmailApp.search(q, 0, 50).forEach(function (t) {
      const id = t.getId();
      if (!seen[id]) { seen[id] = true; threads.push(t); }
    });
  });

  for (const thread of threads) {
    try {
      handleThread_(thread, token, done);
    } catch (e) {
      console.error('blog-by-email: ' + e + ' (subject: "' +
                    thread.getFirstMessageSubject() + '")');
      thread.addLabel(err);   // stop retrying a broken email; inspect it by hand
    }
  }
}

// Reconcile one thread: create its post once, then append any new messages.
function handleThread_(thread, token, doneLabel) {
  const messages = thread.getMessages();
  const threadId = thread.getId();
  let state = loadState_(threadId);

  if (!state) {
    const anchorIdx = findAnchorIndex_(messages);
    if (anchorIdx === -1) return;   // no publishable {BLOG} message; leave it alone

    if (threadHasLabel_(thread, CONFIG.doneLabel)) {
      // Legacy thread: blogged by the OLD script before per-thread state existed.
      // Adopt it WITHOUT recreating the post, and skip its current messages so we
      // never duplicate. (Replies AFTER this point will append best-effort.)
      const anchor = messages[anchorIdx];
      const title = SUBJECT_RE.exec(anchor.getSubject())[2].trim();
      state = { path: expectedPath_(title, anchor.getDate()), n: messages.length };
      saveState_(threadId, state);
    } else {
      // Brand-new thread: create the post from the first {BLOG} message.
      const anchor = messages[anchorIdx];
      const title = SUBJECT_RE.exec(anchor.getSubject())[2].trim();
      const body = cleanBody_(anchor.getPlainBody());
      const path = publishPost_(title, body, anchor.getDate(), token);
      // Persist IMMEDIATELY so this post can never be recreated, even if a later
      // step in this run throws.
      state = { path: path, n: anchorIdx + 1 };
      saveState_(threadId, state);
    }
  }

  // Append every not-yet-processed message (i.e. replies) to the post. The
  // cursor `state.n` is advanced+saved per message, so a mid-way failure can
  // never re-append text that already landed.
  for (let i = state.n; i < messages.length; i++) {
    const msg = messages[i];
    if (senderAllowed_(msg.getFrom())) {
      const body = stripQuotedReply_(cleanBody_(msg.getPlainBody()));
      if (body) appendToPost_(state.path, body, token);
    }
    state.n = i + 1;
    saveState_(threadId, state);
  }

  thread.addLabel(doneLabel);   // idempotent; marks the thread as handled
  thread.markRead();            // so queryReplies won't resurface it until a new reply
}

// First message that is a valid, authorized {BLOG} publish request.
function findAnchorIndex_(messages) {
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const m = SUBJECT_RE.exec(msg.getSubject());
    if (!m) continue;
    if (!senderAllowed_(msg.getFrom())) continue;
    const keyword = (m[1] || '').trim();
    if (CONFIG.secretKeyword && keyword !== CONFIG.secretKeyword) continue;
    return i;
  }
  return -1;
}

// ---- Publishing -------------------------------------------------------------
function publishPost_(title, body, date, token) {
  const tz = CONFIG.timezone;
  const stamp = Utilities.formatDate(date, tz, 'yyyy-MM-dd HH:mm:ss Z');

  const frontMatter =
    '---\n' +
    'layout: post\n' +
    'title:  "' + title.replace(/"/g, '\\"') + '"\n' +
    'date:   ' + stamp + '\n' +
    'categories: ' + CONFIG.categories + '\n' +
    '---\n\n';
  const content = frontMatter + body + '\n';

  const path = uniquePath_(expectedPath_(title, date), token);
  githubPutFile_(path, content, 'Add blog post: ' + title, token);
  console.log('blog-by-email: published ' + path);
  return path;
}

// Append a reply's body to an existing post, separated by a single blank line.
function appendToPost_(path, body, token) {
  const file = githubGetFile_(path, token);
  if (!file) {
    console.warn('blog-by-email: post not found, skipping append: ' + path);
    return;
  }
  const updated = file.content.replace(/\s+$/, '') + '\n\n' + body + '\n';
  githubPutFile_(path, updated, 'Append reply to post: ' + basename_(path), token, file.sha);
  console.log('blog-by-email: appended reply to ' + path);
}

// Canonical path for a title on a given date (before collision numbering).
function expectedPath_(title, date) {
  const ymd = Utilities.formatDate(date, CONFIG.timezone, 'yyyy-MM-dd');
  return CONFIG.postsDir + '/' + ymd + '-' + slugify_(title) + '.markdown';
}

// Mirrors the slug rules in your zsh `blog` function:
//   spaces -> '-', '/' -> '-', strip ? * : " < > | , capitalisation preserved.
function slugify_(title) {
  return title
    .replace(/\//g, '-')
    .replace(/ /g, '-')
    .replace(/[?*:"<>|]/g, '');
}

// Collision handling now only fires for GENUINELY distinct threads that happen
// to share a title on the same day (per-thread state prevents re-publishing the
// same thread). Same title, same day, different thread → ...-Title-2.markdown.
function uniquePath_(path, token) {
  if (!githubExists_(path, token)) return path;
  const dot = path.lastIndexOf('.');
  const base = path.substring(0, dot);
  const ext = path.substring(dot);
  for (let i = 2; i < 50; i++) {
    const candidate = base + '-' + i + ext;
    if (!githubExists_(candidate, token)) return candidate;
  }
  throw new Error('Too many posts with the same title today: ' + path);
}

function basename_(path) {
  return path.substring(path.lastIndexOf('/') + 1);
}

// ---- Body cleanup -----------------------------------------------------------
function cleanBody_(text) {
  if (!text) return '';
  let t = text.replace(/\r\n/g, '\n');
  const sig = t.indexOf('\n-- \n');              // standard signature delimiter
  if (sig !== -1) t = t.substring(0, sig);
  t = t.replace(/\n*Sent from my [^\n]*\s*$/i, '');   // iPhone / Android footer
  t = t.replace(/\n*Get Outlook for [^\n]*\s*$/i, '');
  return t.trim();
}

// Cut off quoted reply history so a reply doesn't re-paste the whole post.
// Only used for replies (never the original post, which may use markdown '>').
// Handles Gmail's "On <date>, <name> <addr> wrote:" (which can wrap across
// lines) and Outlook's "-----Original Message-----".
function stripQuotedReply_(text) {
  if (!text) return text;
  let t = text;
  let cut = t.length;

  const gmail = t.search(/\n\s*On\b[\s\S]{0,400}?\bwrote:\s*\n/);
  if (gmail !== -1) cut = Math.min(cut, gmail);

  const outlook = t.search(/\n\s*-{2,}\s*Original Message\s*-{2,}/i);
  if (outlook !== -1) cut = Math.min(cut, outlook);

  return t.substring(0, cut).trim();
}

// ---- Per-thread state (Script Properties) -----------------------------------
function loadState_(threadId) {
  const raw = PropertiesService.getScriptProperties().getProperty(STATE_PREFIX + threadId);
  return raw ? JSON.parse(raw) : null;
}

function saveState_(threadId, state) {
  PropertiesService.getScriptProperties()
    .setProperty(STATE_PREFIX + threadId, JSON.stringify(state));
}

// ---- GitHub Contents API ----------------------------------------------------
function githubPutFile_(path, content, message, token, sha) {
  const url = contentsUrl_(path);
  const payload = {
    message: message,
    content: Utilities.base64Encode(content, Utilities.Charset.UTF_8), // UTF-8 for ◇ □ etc.
    branch: CONFIG.branch,
  };
  if (sha) payload.sha = sha;   // required when UPDATING an existing file (append)
  const res = UrlFetchApp.fetch(url, {
    method: 'put',
    contentType: 'application/json',
    headers: ghHeaders_(token),
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  const code = res.getResponseCode();
  if (code !== 201 && code !== 200) {
    throw new Error('GitHub PUT failed (' + code + '): ' + res.getContentText());
  }
}

// Returns { content, sha } for an existing file, or null if it doesn't exist.
function githubGetFile_(path, token) {
  const url = contentsUrl_(path) + '?ref=' + encodeURIComponent(CONFIG.branch);
  const res = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: ghHeaders_(token),
    muteHttpExceptions: true,
  });
  const code = res.getResponseCode();
  if (code === 404) return null;
  if (code !== 200) {
    throw new Error('GitHub GET failed (' + code + '): ' + res.getContentText());
  }
  const json = JSON.parse(res.getContentText());
  const bytes = Utilities.base64Decode(json.content.replace(/\n/g, ''));
  const content = Utilities.newBlob(bytes).getDataAsString('UTF-8');
  return { content: content, sha: json.sha };
}

function githubExists_(path, token) {
  return githubGetFile_(path, token) !== null;
}

function contentsUrl_(path) {
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  return 'https://api.github.com/repos/' + CONFIG.owner + '/' + CONFIG.repo +
         '/contents/' + encoded;
}

function ghHeaders_(token) {
  return {
    'Authorization': 'Bearer ' + token,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': CONFIG.owner + '-blog-by-email',
  };
}

// ---- Gmail / sender helpers -------------------------------------------------
function senderAllowed_(from) {
  const addr = extractEmail_(from).toLowerCase();
  return CONFIG.allowedSenders.some(function (a) { return a.toLowerCase() === addr; });
}

function extractEmail_(from) {
  const m = /<([^>]+)>/.exec(from);
  return (m ? m[1] : from).trim();
}

function threadHasLabel_(thread, name) {
  return thread.getLabels().some(function (l) { return l.getName() === name; });
}

function getOrCreateLabel_(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

// ---- One-time installer -----------------------------------------------------
// Run this ONCE from the Apps Script editor. It authorizes the needed scopes
// and installs the 1-minute trigger (removing any duplicate first).
function setup() {
  ScriptApp.getProjectTriggers()
    .filter(function (t) { return t.getHandlerFunction() === 'processBlogEmails'; })
    .forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('processBlogEmails').timeBased().everyMinutes(1).create();
  console.log('Installed 1-minute trigger for processBlogEmails.');
}
