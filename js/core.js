/* UBGForever core: shared helpers, theme + settings, backend client, tab disguise. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function escapeHtml(v) {
    return String(v == null ? '' : v).replace(/[&<>'"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c];
    });
  }
  function formatTime(ts) {
    if (!ts) return 'Never';
    return new Date(ts).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  }
  var toastTimer;
  function toast(message) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = message;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }
  function ls(key, fallback) { try { var v = localStorage.getItem(key); return v === null ? fallback : v; } catch (e) { return fallback; } }
  function lsSet(key, val) { try { localStorage.setItem(key, val); } catch (e) {} }

  window.UBGUI = { $: $, $$: $$, toast: toast, escapeHtml: escapeHtml, formatTime: formatTime, ls: ls, lsSet: lsSet,
    findGameName: function (el) { return (el && (el.getAttribute('data-game-name') || (el.textContent || '').trim())) || ''; } };

  /* ---------- backend (apps catalogue) ---------- */
  var SUPABASE_URL = 'https://belwkmissywvtefueyxj.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_VY3fx5JdleQ0Tr9dTbY9Jw_FeWEM9yx';
  var client = null;
  try { if (window.supabase && window.supabase.createClient) client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY); } catch (e) { console.warn('Backend unavailable', e); }
  window.UBG_SUPABASE = client;

  /* ---------- themes ---------- */
  var THEMES = {
    default:  { name: 'Console',  bg: '#0e0f10', bg2: '#141516', panel: '#1c1d1f', panel2: '#262729', text: '#ffffff', muted: '#a3a6ab', accent: '#107c10', accent2: '#9bf00b' },
    ocean:    { name: 'Ocean',    bg: '#06121a', bg2: '#0a1a24', panel: '#10242f', panel2: '#17323f', text: '#f2fbff', muted: '#8fb0c0', accent: '#0284c7', accent2: '#38d0ff' },
    midnight: { name: 'Midnight', bg: '#0a0b18', bg2: '#10122a', panel: '#171a38', panel2: '#1f2347', text: '#f4f5ff', muted: '#9a9fc8', accent: '#4f46e5', accent2: '#a5b4fc' },
    violet:   { name: 'Violet',   bg: '#0f0a18', bg2: '#160f24', panel: '#1f1632', panel2: '#291d42', text: '#faf5ff', muted: '#a99bc4', accent: '#7c3aed', accent2: '#e879f9' },
    emerald:  { name: 'Emerald',  bg: '#07120e', bg2: '#0b1a14', panel: '#112620', panel2: '#18332b', text: '#f0fff8', muted: '#8fb5a6', accent: '#059669', accent2: '#34d399' },
    sunset:   { name: 'Sunset',   bg: '#140b08', bg2: '#1d100b', panel: '#26140e', panel2: '#331a11', text: '#fff8f2', muted: '#b6a096', accent: '#fb923c', accent2: '#fdba74' },
    rose:     { name: 'Rose',     bg: '#15080f', bg2: '#1e0c16', panel: '#2a101d', panel2: '#361426', text: '#fff6fa', muted: '#b99aaa', accent: '#f472b6', accent2: '#f9a8d4' },
    mono:     { name: 'Mono',     bg: '#09090b', bg2: '#111113', panel: '#18181b', panel2: '#222225', text: '#fafafa', muted: '#a1a1aa', accent: '#e4e4e7', accent2: '#ffffff' }
  };

  function luminance(hex) {
    var h = hex.replace('#', '');
    var c = [0, 2, 4].map(function (i) {
      var v = parseInt(h.substr(i, 2), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }

  var settings = {
    ramOpt: ls('stash_ram_opt', 'true') !== 'false',
    ultOpt: ls('stash_ult_opt', 'false') === 'true',
    theme: ls('stash_theme', 'default'),
    tabName: ls('stash_tab_name', 'UBGForever'),
    tabIcon: ls('stash_tab_icon', 'img/favicon.png')
  };

  function setSiteTheme(key, save) {
    if (!THEMES[key]) key = 'default';
    settings.theme = key;
    if (save !== false) lsSet('stash_theme', key);
    var t = THEMES[key], root = document.documentElement.style;
    root.setProperty('--bg', t.bg); root.setProperty('--bg2', t.bg2);
    root.setProperty('--panel', t.panel); root.setProperty('--panel2', t.panel2);
    root.setProperty('--text', t.text); root.setProperty('--muted', t.muted);
    root.setProperty('--accent', t.accent); root.setProperty('--accent2', t.accent2);
    root.setProperty('--on-accent', luminance(t.accent) > 0.38 ? '#000000' : '#ffffff');
    var meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.setAttribute('content', t.bg);
    $$('[data-theme-key]').forEach(function (el) { el.classList.toggle('on', el.getAttribute('data-theme-key') === key); });
    window.dispatchEvent(new CustomEvent('ubgtheme', { detail: key }));
  }

  var ICONS = [
    ['Classroom', 'https://Stash-Files.b-cdn.net/Images/Stash%20OS%20-%20Falcon/classroom.jpg'],
    ['Docs', 'https://Stash-Files.b-cdn.net/Images/Stash%20OS%20-%20Falcon/docs.png'],
    ['IXL', 'https://Stash-Files.b-cdn.net/Images/Stash%20OS%20-%20Falcon/ixl.png'],
    ['PowerSchool', 'https://Stash-Files.b-cdn.net/Images/Stash%20OS%20-%20Falcon/powerschool.png'],
    ['Default', 'img/favicon.png']
  ];

  function setTabIcon(url, save) {
    settings.tabIcon = url;
    if (save !== false) lsSet('stash_tab_icon', url);
    var f = document.getElementById('site-favicon'); if (f) f.href = url;
    $$('.icon-pick').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-icon') === url); });
  }
  function saveTabName(name) {
    var v = String(name || '').trim();
    if (!v) return;
    settings.tabName = v;
    lsSet('stash_tab_name', v);
    document.title = v;
    var el = document.getElementById('site-tab-title'); if (el) el.textContent = v;
  }

  /* ---------- time on site ---------- */
  var playSeconds = parseInt(ls('stash_playtime_seconds', '0'), 10) || 0;
  function paintPlaytime() {
    var el = document.getElementById('total-playtime-counter');
    if (el) el.textContent = Math.floor(playSeconds / 60) + 'm ' + (playSeconds % 60) + 's';
  }
  setInterval(function () { playSeconds++; lsSet('stash_playtime_seconds', String(playSeconds)); paintPlaytime(); }, 1000);

  /* ---------- clock ---------- */
  function tick() {
    var el = document.getElementById('clock'); if (!el) return;
    el.textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  setInterval(tick, 15000);

  window.UBG = { settings: settings, themes: THEMES, icons: ICONS, setSiteTheme: setSiteTheme, setTabIcon: setTabIcon, saveTabName: saveTabName, paintPlaytime: paintPlaytime, tick: tick };
  setSiteTheme(settings.theme, false);
  setTabIcon(settings.tabIcon, false);
  if (settings.tabName) { document.title = settings.tabName; }
  document.addEventListener('DOMContentLoaded', function () { tick(); paintPlaytime(); });

  /* ---------- landing helpers ---------- */
  window.eduSearch = function () {
    var input = document.getElementById('edu-search-input'); if (!input) return;
    var q = input.value.trim();
    if (q) window.open('https://www.google.com/search?q=' + encodeURIComponent(q), '_blank', 'noopener');
  };
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target && e.target.id === 'edu-search-input') { e.preventDefault(); window.eduSearch(); }
  });
  window.enterUBGMain = function () {
    document.body.classList.remove('landing');
    window.scrollTo(0, 0);
    window.dispatchEvent(new CustomEvent('ubgenter'));
  };
})();
