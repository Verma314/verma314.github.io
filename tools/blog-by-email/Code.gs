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
 * Runs on a 1-minute time trigger. One-time setup: see README.md in this folder.
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

  // SECURITY GUARD — only these senders may publish. "Email to self" means your
  // own address(es). Add every address you might send from. Matching is
  // case-insensitive and checks only the address portion of the From: header.
  allowedSenders: [
    'asverma314@gmail.com',
    'enjoy.your.solitude@gmail.com',
    'a.verma1024@gmail.com',
    'adityasinghverma314@gmail.com',
  ],

  // Optional extra guard. If non-empty, the subject MUST be {BLOG:keyword} title
  // and the keyword must match. Leave '' to rely on the sender allow-list alone.
  secretKeyword: '',

  // Gmail search + labels used for idempotency (so a post is never created twice).
  searchQuery: 'subject:BLOG -label:blogged -label:blog-error newer_than:7d',
  doneLabel: 'blogged',
  errorLabel: 'blog-error',
};

// Subject must look like:  {BLOG} My Title   or   {BLOG:secret} My Title
const SUBJECT_RE = /^\s*\{BLOG(?::([^}]*))?\}\s*(.+?)\s*$/i;

// ---- Entry point (runs on the 1-minute trigger) -----------------------------
function processBlogEmails() {
  const token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) throw new Error('Missing GITHUB_TOKEN script property. See README.');

  const done = getOrCreateLabel_(CONFIG.doneLabel);
  const err = getOrCreateLabel_(CONFIG.errorLabel);

  const threads = GmailApp.search(CONFIG.searchQuery, 0, 20);
  for (const thread of threads) {
    try {
      const published = handleThread_(thread, token);
      if (published) {
        thread.addLabel(done);
        thread.markRead();
      }
    } catch (e) {
      console.error('blog-by-email: ' + e + ' (subject: "' +
                    thread.getFirstMessageSubject() + '")');
      thread.addLabel(err);   // stop retrying a broken email; inspect it by hand
    }
  }
}

function handleThread_(thread, token) {
  let published = false;
  for (const msg of thread.getMessages()) {
    const m = SUBJECT_RE.exec(msg.getSubject());
    if (!m) continue;

    const keyword = (m[1] || '').trim();
    const title = m[2].trim();

    if (!senderAllowed_(msg.getFrom())) {
      console.warn('blog-by-email: rejected sender ' + msg.getFrom());
      continue;
    }
    if (CONFIG.secretKeyword && keyword !== CONFIG.secretKeyword) {
      console.warn('blog-by-email: bad keyword for subject "' + msg.getSubject() + '"');
      continue;
    }

    const body = cleanBody_(msg.getPlainBody());
    publishPost_(title, body, msg.getDate(), token);
    published = true;
  }
  return published;
}

// ---- Publishing -------------------------------------------------------------
function publishPost_(title, body, date, token) {
  const tz = CONFIG.timezone;
  const ymd = Utilities.formatDate(date, tz, 'yyyy-MM-dd');
  const stamp = Utilities.formatDate(date, tz, 'yyyy-MM-dd HH:mm:ss Z');

  const frontMatter =
    '---\n' +
    'layout: post\n' +
    'title:  "' + title.replace(/"/g, '\\"') + '"\n' +
    'date:   ' + stamp + '\n' +
    'categories: ' + CONFIG.categories + '\n' +
    '---\n\n';
  const content = frontMatter + body + '\n';

  const path = uniquePath_(CONFIG.postsDir + '/' + ymd + '-' + slugify_(title) + '.markdown', token);
  githubPutFile_(path, content, 'Add blog post: ' + title, token);
  console.log('blog-by-email: published ' + path);
}

// Mirrors the slug rules in your zsh `blog` function:
//   spaces -> '-', '/' -> '-', strip ? * : " < > | , capitalisation preserved.
function slugify_(title) {
  return title
    .replace(/\//g, '-')
    .replace(/ /g, '-')
    .replace(/[?*:"<>|]/g, '');
}

// If YYYY-MM-DD-Title.markdown already exists, append -2, -3, ... instead of
// clobbering (the local `blog` alias just reopens the file; email can't prompt).
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

// ---- GitHub Contents API ----------------------------------------------------
function githubPutFile_(path, content, message, token) {
  const url = contentsUrl_(path);
  const payload = {
    message: message,
    content: Utilities.base64Encode(content, Utilities.Charset.UTF_8), // UTF-8 for ◇ □ etc.
    branch: CONFIG.branch,
  };
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

function githubExists_(path, token) {
  const url = contentsUrl_(path) + '?ref=' + encodeURIComponent(CONFIG.branch);
  const res = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: ghHeaders_(token),
    muteHttpExceptions: true,
  });
  return res.getResponseCode() === 200;
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
