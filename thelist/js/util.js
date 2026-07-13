/* TheList — util.js: shared helpers */
window.TL = window.TL || {};

TL.util = (() => {
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') node.className = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (v !== null && v !== undefined) node.setAttribute(k, v);
    }
    for (const c of children.flat()) {
      if (c === null || c === undefined) continue;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return node;
  }

  function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  const nowISO = () => new Date().toISOString();

  function debounce(fn, ms) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function timeAgo(iso) {
    if (!iso) return '';
    const s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (isNaN(s)) return '';
    if (s < 60) return 'just now';
    const units = [[31536000, 'y'], [2592000, 'mo'], [604800, 'w'], [86400, 'd'], [3600, 'h'], [60, 'm']];
    for (const [sec, label] of units) {
      if (s >= sec) return Math.floor(s / sec) + label + ' ago';
    }
    return 'just now';
  }

  function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  // UTF-8 safe base64 for GitHub contents API
  function b64EncodeUtf8(str) {
    const bytes = new TextEncoder().encode(str);
    return b64EncodeBytes(bytes);
  }
  function b64EncodeBytes(bytes) {
    let bin = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(bin);
  }
  function b64DecodeUtf8(b64) {
    const bin = atob(b64.replace(/\n/g, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function domainOf(url) {
    try { return new URL(url).hostname.replace(/^(www|m|mobile)\./, ''); }
    catch { return ''; }
  }

  // Normalize a URL so the same resource always maps to one canonical string (dedup key).
  function canonicalUrl(raw) {
    let s = String(raw || '').trim();
    if (!s) return '';
    if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
    let u;
    try { u = new URL(s); } catch { return s; }
    let host = u.hostname.toLowerCase().replace(/^(www|m|mobile)\./, '');

    if (host === 'youtu.be') {
      const id = u.pathname.slice(1).split('/')[0];
      if (id) return 'https://youtube.com/watch?v=' + id;
    }
    if (host === 'twitter.com' || host === 'vxtwitter.com' || host === 'fxtwitter.com' || host === 'nitter.net') host = 'x.com';
    if (host === 'arxiv.org' || host === 'export.arxiv.org') {
      const m = u.pathname.match(/\/(?:abs|pdf|html)\/(.+?)(?:v\d+)?(?:\.pdf)?\/?$/i);
      if (m) return 'https://arxiv.org/abs/' + m[1];
    }

    const params = new URLSearchParams();
    const KEEP = {
      'youtube.com': ['v', 'list'],
      'news.ycombinator.com': ['id'],
      'google.com': ['q'],
    };
    const keep = KEEP[host] || null;
    for (const [k, v] of u.searchParams) {
      if (/^utm_/i.test(k) || ['fbclid', 'gclid', 'igshid', 'mkt_tok', 'ref_src', 'si', 'feature', 'ref'].includes(k)) continue;
      if (host === 'x.com' && ['s', 't'].includes(k)) continue;
      if (keep && !keep.includes(k)) continue;
      params.set(k, v);
    }
    let path = u.pathname.replace(/\/+$/, '') || '/';
    const qs = params.toString();
    return 'https://' + host + path + (qs ? '?' + qs : '');
  }

  // Extract all URLs from a blob of pasted text
  function extractUrls(text) {
    const re = /https?:\/\/[^\s<>"')\]}]+/gi;
    return (text.match(re) || []).map(u => u.replace(/[.,;:!?]+$/, ''));
  }

  // ISO8601 duration (PT1H2M3S) → "1:02:03"
  function fmtDuration(iso) {
    if (!iso) return '';
    const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!m) return '';
    const [, h, min, sec] = m.map(x => parseInt(x || 0, 10));
    const parts = h ? [h, String(min).padStart(2, '0'), String(sec).padStart(2, '0')]
      : [min || 0, String(sec || 0).padStart(2, '0')];
    return parts.join(':');
  }

  function fmtCount(n) {
    if (n == null) return '';
    n = Number(n);
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(n);
  }

  let toastTimer;
  function toast(msg, kind = 'info') {
    const box = $('#toast');
    box.textContent = msg;
    box.className = 'toast show ' + kind;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => box.classList.remove('show'), 3500);
  }

  return {
    $, $$, el, uuid, nowISO, debounce, escapeHtml, timeAgo, fmtDate, clamp,
    b64EncodeUtf8, b64EncodeBytes, b64DecodeUtf8, domainOf, canonicalUrl,
    extractUrls, fmtDuration, fmtCount, toast,
  };
})();
