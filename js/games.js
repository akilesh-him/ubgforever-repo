/* UBGForever games: list, cover art, favorites, recents, Games page and in-page player.
 * Source: github.com/bubbls/ugs-singlefile (UGS-Files). js/games-data.js is a bundled
 * snapshot; the list is refreshed live from jsDelivr when reachable. Additional game
 * providers are registered in js/games-providers.js and their catalogs are fetched live.
 * Game files load through the same origin game proxy so direct provider urls are never
 * exposed to blockers. Duplicate games across providers keep the highest priority most
 * polished up to date copy. */
(function () {
  'use strict';
  var LIST_API = 'https://data.jsdelivr.com/v1/packages/gh/bubbls/ugs-singlefile@main?structure=flat';
  var PROXY = '/game-proxy';
  var PAGE = 120, FAV_KEY = 'ubg_game_favs', REC_KEY = 'ubg_game_recent';
  var CATALOG_TIMEOUT = 15000;

  var providerGames = [], bundledGames = [], providerFilter = 'ugs';
  var root = null;
  var all = [], byId = {}, filtered = [], rendered = 0, query = '', letter = 'ALL', observer = null;
  var favs = readList(FAV_KEY), recents = readList(REC_KEY);
  var activeId = null, activeBlob = null;
  var providerPriority = {};
  (window.UBG_GAME_PROVIDERS || []).forEach(function (p) {
    providerPriority[p.id] = p.priority == null ? 99 : p.priority;
  });

  function readList(k) { try { var v = JSON.parse(localStorage.getItem(k) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  function writeList(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function cssEsc(s) { return String(s).replace(/["\\]/g, '\\$&'); }

  function normId(id) {
    return String(id).replace(/^cl/i, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }
  function canonId(id) {
    var n = normId(id);
    return n ? 'cl' + n : String(id);
  }
  function prettify(id) {
    var s = id.replace(/^cl/i, '').replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\s+/g, ' ').trim();
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function makeGame(g) {
    var id = g.id;
    var name = g.name || (window.UBG_GAME_TITLES && window.UBG_GAME_TITLES[id]) || prettify(id);
    var file = g.file || id + '.html';
    var cover = g.cover || null;
    var c = name.charAt(0).toUpperCase();
    return { id: id, name: name, provider: g.provider || 'ugs', file: file, cover: cover,
      search: (name + ' ' + id.replace(/^cl/i, '')).toLowerCase(), letter: /[A-Z]/.test(c) ? c : '#', norm: normId(id) };
  }
  function setGames(games) {
    var remote = games.filter(function (g) { return g.id !== 'wispcraft'; });
    var local = [{ id: 'wispcraft', name: 'Wispcraft', provider: 'ugs', file: '/apps/wispcraft/index.html' }];
    // dedup by normalized id: keep highest priority most polished up to date provider copy
    var chosen = {};
    remote.forEach(function (g) {
      var key = g.norm || normId(g.name || g.id);
      var cur = chosen[key];
      var rank = providerPriority[g.provider] == null ? 99 : providerPriority[g.provider];
      if (!cur || rank < (providerPriority[cur.provider] == null ? 99 : providerPriority[cur.provider])) {
        chosen[key] = g;
      }
    });
    providerGames = remote.filter(function (g) { return g.id.toLowerCase() !== 'clai'; }).concat(local).map(makeGame);
    remote = Object.values(chosen);
    remote = remote.filter(function (g) { return g.id.toLowerCase() !== 'clai'; });
    all = remote.concat(local).map(makeGame).sort(function (a, b) {
      var art = window.SlipstreamGameArt || {};
      return Number(Boolean(art[b.id] || b.cover)) - Number(Boolean(art[a.id] || a.cover)) ||
        a.name.localeCompare(b.name, 'en', { sensitivity: 'base', numeric: true });
    });
    byId = {}; providerGames.forEach(function (g) { byId[g.id] = g; }); all.forEach(function (g) { byId[g.id] = g; });
  }

  /* ---------- cover art ---------- */
  function coverHtml(g) {
    var art = g.cover || (window.SlipstreamGameArt || {})[g.id];
    return '<span class="cover"><span class="mono" aria-hidden="true">' + esc(g.name.replace(/[^a-z0-9]/gi, '').slice(0, 2).toUpperCase()) + '</span>' + (art ? '<img class="cover-img" src="' + esc(art) + '" alt="" loading="lazy" decoding="async" onerror="this.remove()">' : '') + '</span>';
  }

  var STAR = function (on) { return '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 3.5l2.6 5.4 5.9 .8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.7l5.9-.8z" fill="' + (on ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>'; };
  function tileHtml(g, opts) {
    opts = opts || {};
    var on = favs.indexOf(g.id) !== -1;
    var attributes = ' data-game-id="' + esc(g.id) + '" data-game-name="' + esc(g.name) + '"';
    var content = coverHtml(g) + '<span class="tile-name">' + esc(g.name) + '</span>';
    if (opts.noFav) {
      return '<div class="tile" role="button" tabindex="0"' + attributes + '>' + content + '</div>';
    }
    return '<div class="tile"' + attributes + '>' +
      '<button class="tile-launch" type="button" aria-label="Play ' + esc(g.name) + '">' + content + '</button>' +
      '<button type="button" class="fav' + (on ? ' on' : '') + '" aria-pressed="' + on +
      '" aria-label="' + (on ? 'Remove from' : 'Add to') + ' favorites">' + STAR(on) + '</button></div>';
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
      b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); b.setAttribute('aria-label', on ? 'Remove from favorites' : 'Add to favorites'); b.innerHTML = STAR(on);
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
    var games = ids.map(function (id) { return byId[id]; }).filter(function (game) { return game && game.provider === providerFilter; });
    return games.length ? '<section class="g-shelf"><h2>' + title + '</h2><div class="row-track">' + games.map(function (g) { return tileHtml(g); }).join('') + '</div></section>' : '';
  }
  function renderShelves() {
    var el = root && root.querySelector('#g-shelves'); if (!el) return;
    el.innerHTML = (query || letter !== 'ALL') ? '' : row('Recently played', recents) + row('Favorites', favs);
  }

  /* ---------- Games page ---------- */
  function providerOptions() {
    return (window.UBG_GAME_PROVIDERS || []).filter(function (provider) {
      return provider.id === 'ugs' || bundledGames.some(function (game) { return game.provider === provider.id; });
    }).map(function (provider) {
      return '<option value="' + esc(provider.id) + '"' + (provider.id === providerFilter ? ' selected' : '') + '>' + esc(provider.name) + '</option>';
    }).join('');
  }
  function mount() {
    root = document.getElementById('v-games'); if (!root) return;
    var letters = ['ALL', '#']; for (var i = 65; i <= 90; i++) letters.push(String.fromCharCode(i));
    root.innerHTML =
      '<div class="g-head"><h1>Games</h1><span class="g-count" id="g-count"></span></div>' +
      '<div class="g-bar"><label class="g-search"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M21 21l-4.3-4.3M10.5 18a7.5 7.5 0 110-15 7.5 7.5 0 010 15z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' +
        '<input id="g-search" type="search" autocomplete="off" spellcheck="false" placeholder="Search games" aria-label="Search games"/><kbd aria-hidden="true">/</kbd></label>' +
        '<button type="button" class="btn accent" id="g-surprise">Surprise me</button></div>' +
      '<div class="g-filters"><div class="g-letters" id="g-letters" role="group" aria-label="Filter by first letter">' +
        letters.map(function (l) { return '<button type="button" class="g-letter' + (l === 'ALL' ? ' on' : '') + '" data-letter="' + l + '" aria-pressed="' + (l === 'ALL') + '">' + (l === 'ALL' ? 'All' : l) + '</button>'; }).join('') + '</div>' +
      '<label class="g-provider-select"><span class="sr-only">Game provider</span><select id="g-provider-select" aria-label="Game provider">' + providerOptions() + '</select></label></div>' +
      '<div id="g-shelves"></div><div id="g-list"></div><div id="g-sentinel" style="height:1px"></div>';

    var input = root.querySelector('#g-search'), t = null;
    input.addEventListener('input', function (e) { var v = e.target.value; clearTimeout(t); t = setTimeout(function () { query = v.trim().toLowerCase(); applyFilter(); }, 100); });
    root.querySelector('#g-surprise').addEventListener('click', surprise);
    root.querySelector('#g-provider-select').onchange = function (event) { providerFilter = event.target.value; applyFilter(); };
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
    var pool = providerGames.filter(function (g) { return g.provider === providerFilter; });
    filtered = pool.filter(function (g) { return (letter === 'ALL' || g.letter === letter) && (!query || g.search.indexOf(query) !== -1); });
    rendered = 0;
    var list = root.querySelector('#g-list'); list.innerHTML = '';
    var c = root.querySelector('#g-count');
    c.textContent = filtered.length === pool.length ? pool.length.toLocaleString() : filtered.length.toLocaleString() + ' of ' + pool.length.toLocaleString();
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
  function loadSnapshot() {
    var s = window.UBG_GAMES_SNAPSHOT;
    if (Array.isArray(s) && s.length) {
      setGames(s.map(function (id) {
        return { id: id, provider: 'ugs', file: id + '.html', name: null, norm: normId(id) };
      }));
    }
  }
  function fetchJson(u, timeout) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, timeout || CATALOG_TIMEOUT);
    return fetch(u, { cache: 'no-cache', signal: controller.signal })
      .then(function (r) {
        clearTimeout(timer);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .catch(function (e) {
        clearTimeout(timer);
        throw e;
      });
  }
  function loadUgs() {
    return fetchJson(LIST_API).then(function (d) {
      var p = '/UGS-Files/';
      return (d.files || []).map(function (f) { return f.name; })
        .filter(function (n) { return n.indexOf(p) === 0 && /^cl[^/]+\.html$/.test(n.slice(p.length)); })
        .map(function (n) {
          var id = n.slice(p.length, -5);
          return { id: id, provider: 'ugs', file: id + '.html', name: null, norm: normId(id) };
        });
    });
  }
  function snapshotGames() {
    return (window.UBG_GAMES_SNAPSHOT || []).map(function (id) {
      return { id: id, provider: 'ugs', file: id + '.html', norm: normId(id) };
    });
  }
  function refreshLive() {
    fetchJson('/js/provider-catalog.json').then(function (catalog) {
      bundledGames = catalog.games;
      setGames(snapshotGames().concat(bundledGames));
      if (root) {
        root.querySelector('#g-provider-select').innerHTML = providerOptions();
        applyFilter();
      }
      window.dispatchEvent(new CustomEvent('ubggames'));
      return loadUgs().then(function (games) {
        if (games.length) setGames(games.concat(bundledGames));
        if (root) applyFilter();
        window.dispatchEvent(new CustomEvent('ubggames'));
      }).catch(function () {});
    }).catch(function (error) {
      console.warn('[Games] bundled providers unavailable:', error.message);
    });
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
    el.querySelector('#game-newtab').onclick = function () { if (activeId === 'wispcraft') window.open(wispcraftUrl(), '_blank'); else if (activeBlob) window.open(activeBlob, '_blank'); };
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
  function wispcraftUrl() { return '/apps/wispcraft/index.html?wisp=' + encodeURIComponent((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/wisp/'); }
  function proxyUrl(provider, file) {
    return PROXY + '?provider=' + encodeURIComponent(provider) + '&file=' + encodeURIComponent(file);
  }
  function play(id, isReload) {
    if (!id) return;
    var g = byId[id] || makeGame({ id: id, provider: 'ugs', file: id + '.html', name: null, norm: normId(id) });
    var provider = g.provider || 'ugs';
    var el = ensurePlayer(), frame = el.querySelector('#game-frame');
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
    if (id === 'wispcraft') {
      frame.onload = function () { if (activeId === id) { frame.style.visibility = 'visible'; status(''); } };
      frame.src = wispcraftUrl();
      return;
    }
    frame.onload = null;
    fetchText(proxyUrl(provider, g.file)).then(function (html) {
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
  window.UBGGames = { play: play, close: closeGame, surprise: surprise, search: search, countMatches: countMatches, pick: pick, featured: function (n) {
      var ids = ['clsubwaysurf' , 'cldrivemad', 'clretrobowl', 'clslope', 'cl1v1lol', 'clminecraft', 'clgeometrydash', 'clbitlife', 'clbasketballstars', 'cltunnelrush', 'clcookieclicker', 'clrun3', 'cl2048', 'cl3dash'];
      var selected = ids.map(function (id) { return byId[id]; }).filter(function (g) { return g && (window.SlipstreamGameArt || {})[g.id]; });
      return selected.concat(all.filter(function (g) { return (window.SlipstreamGameArt || {})[g.id] && !ids.includes(g.id); })).slice(0, n || 14);
    }, recent: recentGames,
    favorites: function () { return favs.map(function (id) { return byId[id]; }).filter(Boolean); },
    tileHtml: tileHtml, coverHtml: coverHtml, openWith: openWith, total: function () { return all.length; }, refresh: refreshLive };
})();
