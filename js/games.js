/* UBGForever games: list, cover art, favorites, recents, Games page and in-page player.
 * Source: github.com/bubbls/ugs-singlefile (UGS-Files). js/games-data.js is a bundled
 * snapshot; the list is refreshed live from jsDelivr when reachable. */
(function () {
  'use strict';
  var REPO = 'bubbls/ugs-singlefile', BRANCH = 'main', FOLDER = 'UGS-Files';
  var CDN = 'https://cdn.jsdelivr.net/gh/' + REPO + '/' + FOLDER + '/';
  var RAW = 'https://raw.githubusercontent.com/' + REPO + '/' + BRANCH + '/' + FOLDER + '/';
  var LIST_API = 'https://data.jsdelivr.com/v1/packages/gh/' + REPO + '@' + BRANCH + '?structure=flat';
  var PAGE = 120, FAV_KEY = 'ubg_game_favs', REC_KEY = 'ubg_game_recent';

  var root = null;
  var all = [], byId = {}, filtered = [], rendered = 0, query = '', letter = 'ALL', observer = null;
  var favs = readList(FAV_KEY), recents = readList(REC_KEY);
  var activeId = null, activeBlob = null;

  function readList(k) { try { var v = JSON.parse(localStorage.getItem(k) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  function writeList(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function cssEsc(s) { return String(s).replace(/["\\]/g, '\\$&'); }

  function prettify(id) {
    var s = id.replace(/^cl/i, '').replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\s+/g, ' ').trim();
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function makeGame(id) {
    var name = (window.UBG_GAME_TITLES && window.UBG_GAME_TITLES[id]) || prettify(id);
    var c = name.charAt(0).toUpperCase();
    return { id: id, name: name, search: (name + ' ' + id.replace(/^cl/i, '')).toLowerCase(), letter: /[A-Z]/.test(c) ? c : '#' };
  }
  function setGames(ids) {
    all = ids.map(makeGame).sort(function (a, b) { return a.name.localeCompare(b.name, 'en', { sensitivity: 'base', numeric: true }); });
    byId = {}; all.forEach(function (g) { byId[g.id] = g; });
  }

  /* ---------- cover art ---------- */
  var COLORS = ['#107c10', '#0078d4', '#e81123', '#ffb900', '#8661c5', '#00b294', '#ff8c00', '#e3008c', '#2d7d9a', '#c239b3'];
  function hash(s) { var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return Math.abs(h); }
  function mono(name) {
    var c = name.replace(/[^A-Za-z0-9 ]/g, '').trim();
    if (!c) return '?';
    var w = c.split(' ');
    if (w.length > 1) return (w[0].charAt(0) + w[1].charAt(0)).toUpperCase();
    return c.charAt(0).toUpperCase() + c.charAt(1).toLowerCase();
  }
  function coverHtml(g) {
    var h = hash(g.id);
    return '<span class="cover gp' + ((h >> 3) % 6) + '" style="--cv:' + COLORS[h % COLORS.length] + ';--h:' + (h % 360) + '"><span class="mono">' + esc(mono(g.name)) + '</span><img class="cover-img" src="game-pictures/' + encodeURIComponent(g.id) + '.jpg" alt="" loading="lazy" onerror="this.remove()"></span>';
  }
  var STAR = function (on) { return '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.7l5.9-.8z" fill="' + (on ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>'; };
  function tileHtml(g, opts) {
    opts = opts || {};
    var on = favs.indexOf(g.id) !== -1;
    return '<div class="tile" role="button" tabindex="0" data-game-id="' + esc(g.id) + '" data-game-name="' + esc(g.name) + '">' + coverHtml(g) +
      (opts.noFav ? '' : '<button type="button" class="fav' + (on ? ' on' : '') + '" aria-pressed="' + on + '" aria-label="' + (on ? 'Remove from' : 'Add to') + ' favorites">' + STAR(on) + '</button>') +
      '<span class="tile-name">' + esc(g.name) + '</span></div>';
  }

  /* ---------- public helpers ---------- */
  function pick(n) {
    var pool = all.slice(), out = [];
    while (out.length < n && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    return out;
  }
  function recentGames(n) { return recents.map(function (id) { return byId[id]; }).filter(Boolean).slice(0, n || 12); }
  function search(q, limit) {
    q = String(q || '').trim().toLowerCase();
    if (!q) return [];
    var starts = [], rest = [];
    all.forEach(function (g) {
      if (g.search.indexOf(q) === -1) return;
      (g.name.toLowerCase().indexOf(q) === 0 ? starts : rest).push(g);
    });
    return starts.concat(rest).slice(0, limit || 24);
  }
  function countMatches(q) { q = String(q || '').trim().toLowerCase(); return all.filter(function (g) { return g.search.indexOf(q) !== -1; }).length; }

  /* ---------- favorites / recents ---------- */
  function toggleFav(id) {
    var i = favs.indexOf(id);
    if (i === -1) favs.unshift(id); else favs.splice(i, 1);
    writeList(FAV_KEY, favs);
    var on = favs.indexOf(id) !== -1;
    document.querySelectorAll('.tile[data-game-id="' + cssEsc(id) + '"] .fav').forEach(function (b) {
      b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); b.innerHTML = STAR(on);
    });
    var pf = document.getElementById('game-fav'); if (pf && activeId === id) pf.classList.toggle('on', on);
    renderShelves();
    if (window.UBGStore) { var g = byId[id]; if (g) window.UBGStore.toggleFavorite(g.name); }
  }
  function pushRecent(id) {
    recents = [id].concat(recents.filter(function (x) { return x !== id; })).slice(0, 14);
    writeList(REC_KEY, recents);
    renderShelves();
    window.dispatchEvent(new CustomEvent('ubgrecent'));
  }
  function row(title, ids) {
    var games = ids.map(function (id) { return byId[id]; }).filter(Boolean);
    return games.length ? '<section class="g-shelf"><h2>' + title + '</h2><div class="row-track">' + games.map(function (g) { return tileHtml(g); }).join('') + '</div></section>' : '';
  }
  function renderShelves() {
    var el = root && root.querySelector('#g-shelves'); if (!el) return;
    el.innerHTML = (query || letter !== 'ALL') ? '' : row('Recently played', recents) + row('Favorites', favs);
  }

  /* ---------- Games page ---------- */
  function mount() {
    root = document.getElementById('v-games'); if (!root) return;
    var letters = ['ALL', '#']; for (var i = 65; i <= 90; i++) letters.push(String.fromCharCode(i));
    root.innerHTML =
      '<div class="g-head"><h1>Games</h1><span class="g-count" id="g-count"></span></div>' +
      '<div class="g-bar"><label class="g-search"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M21 21l-4.3-4.3M10.5 18a7.5 7.5 0 110-15 7.5 7.5 0 010 15z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' +
        '<input id="g-search" type="search" autocomplete="off" spellcheck="false" placeholder="Search games" aria-label="Search games"/><kbd aria-hidden="true">/</kbd></label>' +
        '<button type="button" class="btn accent" id="g-surprise">Surprise me</button></div>' +
      '<div class="g-letters" id="g-letters" role="group" aria-label="Filter by first letter">' +
        letters.map(function (l) { return '<button type="button" class="g-letter' + (l === 'ALL' ? ' on' : '') + '" data-letter="' + l + '" aria-pressed="' + (l === 'ALL') + '">' + (l === 'ALL' ? 'All' : l) + '</button>'; }).join('') + '</div>' +
      '<div id="g-shelves"></div><div id="g-list"></div><div id="g-sentinel" style="height:1px"></div>';

    var input = root.querySelector('#g-search'), t = null;
    input.addEventListener('input', function (e) { var v = e.target.value; clearTimeout(t); t = setTimeout(function () { query = v.trim().toLowerCase(); applyFilter(); }, 100); });
    root.querySelector('#g-surprise').addEventListener('click', surprise);
    root.querySelector('#g-letters').addEventListener('click', function (e) { var b = e.target.closest('.g-letter'); if (b) setLetter(b.getAttribute('data-letter')); });
    document.addEventListener('keydown', function (e) {
      if (e.key === '/' && !root.hidden && !/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) { e.preventDefault(); input.focus(); }
    });
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(function (en) { if (en[0].isIntersecting) renderMore(); }, { rootMargin: '700px 0px' });
      observer.observe(root.querySelector('#g-sentinel'));
    }
    applyFilter();
  }
  function setLetter(l) {
    letter = l;
    root.querySelectorAll('.g-letter').forEach(function (x) { var on = x.getAttribute('data-letter') === l; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); });
    applyFilter();
  }
  function applyFilter() {
    filtered = all.filter(function (g) { return (letter === 'ALL' || g.letter === letter) && (!query || g.search.indexOf(query) !== -1); });
    rendered = 0;
    var list = root.querySelector('#g-list'); list.innerHTML = '';
    var c = root.querySelector('#g-count');
    c.textContent = filtered.length === all.length ? all.length.toLocaleString() : filtered.length.toLocaleString() + ' of ' + all.length.toLocaleString();
    renderShelves();
    if (!filtered.length) {
      list.innerHTML = '<div class="empty"><b>No games found</b>Nothing matches “' + esc(query || letter) + '”. Try fewer letters or clear the filter.<br><button type="button" class="btn outline" id="g-clear">Clear search</button></div>';
      list.querySelector('#g-clear').onclick = function () { root.querySelector('#g-search').value = ''; query = ''; setLetter('ALL'); };
      return;
    }
    renderMore();
  }
  function renderMore() {
    if (!root || rendered >= filtered.length) return;
    var list = root.querySelector('#g-list'), slice = filtered.slice(rendered, rendered + PAGE);
    var sec = list.lastElementChild, last = sec && sec.getAttribute('data-letter'), grid = sec && sec.querySelector('.g-grid');
    slice.forEach(function (g) {
      if (g.letter !== last) {
        sec = document.createElement('section'); sec.className = 'g-section'; sec.setAttribute('data-letter', g.letter);
        sec.innerHTML = '<h2>' + esc(g.letter) + '</h2><div class="g-grid"></div>';
        list.appendChild(sec); grid = sec.querySelector('.g-grid'); last = g.letter;
      }
      grid.insertAdjacentHTML('beforeend', tileHtml(g));
    });
    rendered += slice.length;
    if (!observer && rendered < filtered.length) setTimeout(renderMore, 40);
  }
  function openWith(q) {
    if (!root) return;
    var input = root.querySelector('#g-search'); input.value = q || '';
    query = (q || '').trim().toLowerCase(); letter = 'ALL';
    root.querySelectorAll('.g-letter').forEach(function (x) { var on = x.getAttribute('data-letter') === 'ALL'; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); });
    applyFilter();
  }
  function surprise() { if (all.length) play(all[Math.floor(Math.random() * all.length)].id); }

  /* ---------- list loading ---------- */
  function loadSnapshot() { var s = window.UBG_GAMES_SNAPSHOT; if (Array.isArray(s) && s.length) setGames(s); }
  function refreshLive() {
    return fetch(LIST_API, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error('list ' + r.status); return r.json(); })
      .then(function (d) {
        var p = '/' + FOLDER + '/';
        var ids = (d.files || []).map(function (f) { return f.name; }).filter(function (n) { return n.indexOf(p) === 0 && /^cl[^/]+\.html$/.test(n.slice(p.length)); }).map(function (n) { return n.slice(p.length, -5); });
        if (ids.length < 50) throw new Error('list too small');
        setGames(ids); if (root) applyFilter();
        window.dispatchEvent(new CustomEvent('ubggames'));
      }).catch(function (e) { console.warn('[Games] live list unavailable, using bundled snapshot:', e.message); });
  }

  /* ---------- player ---------- */
  function ensurePlayer() {
    var el = document.getElementById('game-player'); if (el) return el;
    el = document.createElement('div'); el.id = 'game-player'; el.className = 'player'; el.hidden = true;
    el.innerHTML =
      '<header class="player-bar"><button class="pbtn" id="game-exit" type="button">← Back</button><h2 id="game-title"></h2>' +
      '<button class="pbtn" id="game-fav" type="button" aria-label="Favorite">★ Favorite</button><button class="pbtn" id="game-reload" type="button">Reload</button>' +
      '<button class="pbtn" id="game-newtab" type="button">New tab</button><button class="pbtn" id="game-full" type="button">Fullscreen</button></header>' +
      '<div class="player-stage"><div class="player-loader" id="game-status"></div><iframe id="game-frame" title="Game" allow="fullscreen; autoplay; gamepad; clipboard-write"></iframe></div>';
    document.body.appendChild(el);
    el.querySelector('#game-exit').onclick = closeGame;
    el.querySelector('#game-reload').onclick = function () { if (activeId) play(activeId, true); };
    el.querySelector('#game-fav').onclick = function () { if (activeId) toggleFav(activeId); };
    el.querySelector('#game-full').onclick = function () { var f = el.querySelector('#game-frame'); (f.requestFullscreen || f.webkitRequestFullscreen || function () {}).call(f); };
    el.querySelector('#game-newtab').onclick = function () { if (activeBlob) window.open(activeBlob, '_blank'); };
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !el.hidden && !document.fullscreenElement) closeGame(); });
    return el;
  }
  function status(html) { var s = document.getElementById('game-status'); s.innerHTML = html || ''; s.classList.toggle('done', !html); s.style.display = html ? 'flex' : 'none'; }
  function closeGame() {
    var el = document.getElementById('game-player'); if (!el) return;
    var f = el.querySelector('#game-frame'); f.removeAttribute('srcdoc'); f.src = 'about:blank';
    el.hidden = true; document.body.style.overflow = '';
    if (activeBlob) { URL.revokeObjectURL(activeBlob); activeBlob = null; }
    activeId = null;
  }
  function fetchText(u) { return fetch(u).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); }); }
  function play(id, isReload) {
    if (!id) return;
    var g = byId[id] || makeGame(id), el = ensurePlayer(), frame = el.querySelector('#game-frame'), file = encodeURIComponent(id + '.html');
    activeId = id;
    el.querySelector('#game-title').textContent = g.name;
    el.querySelector('#game-fav').classList.toggle('on', favs.indexOf(id) !== -1);
    el.hidden = false; document.body.style.overflow = 'hidden';
    frame.style.visibility = 'hidden'; frame.removeAttribute('srcdoc');
    status('<div class="cover-wrap" style="width:130px">' + coverHtml(g) + '</div><div>Loading <b>' + esc(g.name) + '</b></div><span class="spin"></span>');
    if (!isReload) {
      pushRecent(id);
      if (window.UBGStore) { window.UBGStore.addHistory(g.name); window.UBGStore.addActivity('Played ' + g.name); }
    }
    fetchText(CDN + file).catch(function () { return fetchText(RAW + file); }).then(function (html) {
      if (activeId !== id) return;
      if (activeBlob) URL.revokeObjectURL(activeBlob);
      activeBlob = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
      frame.srcdoc = html; frame.style.visibility = 'visible'; status('');
      setTimeout(function () { try { frame.focus(); } catch (e) {} }, 100);
    }).catch(function (err) {
      if (activeId !== id) return;
      console.warn('[Games] failed to load', id, err);
      status('<b>Couldn\u2019t load ' + esc(g.name) + '</b><span>The game file may be too large for the CDN, or the network blocked it. Check your connection and try again.</span>' +
        '<div class="player-actions"><button type="button" class="btn accent" id="game-retry">Try again</button><button type="button" class="btn outline" id="game-back2">Back</button></div>');
      document.getElementById('game-retry').onclick = function () { play(id, true); };
      document.getElementById('game-back2').onclick = closeGame;
    });
  }

  /* ---------- delegated tile interaction (works on every page) ---------- */
  document.addEventListener('click', function (e) {
    var tile = e.target.closest('.tile[data-game-id]'); if (!tile) return;
    var fav = e.target.closest('.fav');
    if (fav) { e.stopPropagation(); toggleFav(tile.getAttribute('data-game-id')); return; }
    play(tile.getAttribute('data-game-id'));
  });
  document.addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('tile') && e.target.hasAttribute('data-game-id')) {
      e.preventDefault(); play(e.target.getAttribute('data-game-id'));
    }
  });

  loadSnapshot();
  document.addEventListener('DOMContentLoaded', function () { mount(); });
  refreshLive();
  window.UBGGames = { play: play, close: closeGame, surprise: surprise, search: search, countMatches: countMatches, pick: pick, recent: recentGames,
    favorites: function () { return favs.map(function (id) { return byId[id]; }).filter(Boolean); },
    tileHtml: tileHtml, coverHtml: coverHtml, openWith: openWith, total: function () { return all.length; }, refresh: refreshLive };
})();
