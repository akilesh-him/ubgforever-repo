/* UBGForever app controller: routing, home, apps, search, app pages, player, settings. */
(function () {
  'use strict';
  var U = window.UBGUI, $ = U.$, $$ = U.$$, esc = U.escapeHtml, G = function () { return window.UBGGames; };
  var apps = (window.SlipstreamApps || []).slice(), sorted = [], category = 'all', sortKey = 'alphabetical', shown = 24, current = null, appsLoaded = false;
  var LEGACY = { 'home-page-view': 'v-home', 'search-page-view': 'v-search', 'app-details-view': 'v-app', 'app-player-view': 'v-player', 'browser-page-view': 'v-browser', 'game-vault-view': 'v-games', 'links-page-view': 'v-links', 'settings-page-view': 'v-settings' };
  var NAV = { 'v-home': 'home', 'v-games': 'games', 'v-apps': 'apps', 'v-app': 'apps', 'v-search': '', 'v-browser': 'browser', 'v-links': 'links', 'v-settings': '', 'v-profile': '', 'v-ai': 'ai' };

  /* ---------- views ---------- */
  function showView(id) {
    id = LEGACY[id] || id;
    if (id === 'v-player') { $('#v-player').hidden = false; document.body.style.overflow = 'hidden'; return; }
    $('#v-player').hidden = true; document.body.style.overflow = '';
    document.body.classList.toggle('browser-active', id === 'v-browser');
    $$('.view').forEach(function (v) { v.hidden = v.id !== id; });
    window.dispatchEvent(new CustomEvent('slipstreamnavigate', { detail: { view: id } }));
    var key = NAV[id] || '';
    $$('[data-nav]').forEach(function (a) { a.classList.toggle('on', a.getAttribute('data-nav') === key); });
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
    if (id === 'v-profile' && window.UBGProfile) window.UBGProfile.render();
    if (id === 'v-browser' && window.UBGBrowserInit) window.UBGBrowserInit();
    if (id === 'v-links' && window.UBGLinksRender) window.UBGLinksRender();
  }
  window.showView = showView;

  function route() {
    var h = decodeURIComponent((location.hash || '#home').slice(1)), p = h.split('/'), a = p[0], rest = p.slice(1).join('/');
    if (a === 'app' && rest) return openApp(rest, false);
    if (a === 'play' && rest) { var ap = byId(rest); if (ap) { current = ap; return launchPlayer(false); } return showView('v-home'); }
    if (a === 'category') return showApps(rest || 'all');
    if (a === 'search') return runSearch(rest);
    if (a === 'games') { showView('v-games'); if (G()) G().openWith(rest || ''); return; }
    if (a === 'ai') return showView('v-ai');
    if (a === 'apps') return showApps('all');
    if (a === 'settings') { renderSettings(); return showView('v-settings'); }
    if (a === 'browser') return showView('v-browser');
    if (a === 'links') return showView('v-links');
    if (a === 'profile') return showView('v-profile');
    renderHome(); showView('v-home');
  }

  /* ---------- data ---------- */
  function byId(id) { return apps.filter(function (a) { return String(a.id) === String(id); })[0]; }
  function plain(html) { return String(html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(); }
  function loadApps() {
    var c = window.UBG_SUPABASE;
    if (!c) { appsLoaded = true; return Promise.resolve(); }
    return Promise.resolve(c.from('apps').select('*')).then(function (res) {
      if (res && !res.error && res.data) apps = (window.SlipstreamApps || []).concat(res.data.filter(function (a) { return !window.SlipstreamApps.some(function (b) { return String(a.id) === b.id; }); }));
    }).catch(function (e) { console.error('Data fetch error:', e); }).then(function () { appsLoaded = true; sortApps(); renderHome(); renderApps();  });
  }
  function sortApps() {
    sorted = apps.filter(function (a) { return category === 'all' || a.category === category; });
    var by = { alphabetical: function (a, b) { return (a.name || '').localeCompare(b.name || ''); }, downloads: function (a, b) { return (b.downloads || 0) - (a.downloads || 0); }, likes: function (a, b) { return (b.likes || 0) - (a.likes || 0); }, newest: function (a, b) { return new Date(b.created_at || 0) - new Date(a.created_at || 0); } };
    sorted.sort(by[sortKey] || by.alphabetical);
  }

  /* ---------- tiles ---------- */
  function appIcon(a, cls) {
    return a.img ? '<img class="' + cls + '" src="' + esc(a.img) + '" alt="" loading="lazy" onerror="this.style.visibility=\'hidden\'">' : '<div class="' + cls + '"></div>';
  }
  function appTile(a) {
    return '<a class="app-tile" href="#app/' + esc(a.id) + '">' + appIcon(a, 'app-ico') + '<div><b>' + esc(a.name) + '</b><small>' + esc(a.category || 'App') + '</small><p>' + esc(plain(a.description)) + '</p></div></a>';
  }

  /* ---------- home ---------- */
  function renderCollage() {
    var el = $('#collage'), g = G(); if (!el || !g) return;
    var picks = g.featured(6);
    el.innerHTML = [picks.slice(0, 3), picks.slice(3, 6)].map(function (row) { return '<div class="collage-row"><div class="collage-track">' + row.map(function (x) { return g.tileHtml(x, { noFav: true }); }).join('') + '</div></div>'; }).join('');
  }
  function renderHome() {
    var g = G();
    var n = $('#hx-count'); if (n && g) n.textContent = g.total().toLocaleString();
    var na = $('#hx-apps'); if (na) na.textContent = apps.length.toLocaleString();
    var name = window.UBGStore && window.UBGStore.get().profile.name;
    var eb = $('#hero-eyebrow'); if (eb) eb.textContent = name && name !== 'Player' ? 'Welcome back, ' + name : '';
    renderCollage();
    var rec = g ? g.recent(12) : [], cont = $('#blk-continue');
    cont.hidden = !rec.length;
    $('#continue-track').innerHTML = rec.map(function (x) { return g.tileHtml(x); }).join('');
    $('#home-games').innerHTML = g ? g.featured(14).map(function (x) { return g.tileHtml(x); }).join('') : '';
    var top = apps.slice().sort(function (a, b) { return (b.downloads || 0) - (a.downloads || 0); }).slice(0, 6);
    $('#blk-trending').hidden = !top.length;
    $('#trending').innerHTML = top.map(function (a, i) {
      return '<li><a class="rank-item" href="#app/' + esc(a.id) + '"><span class="rank-n">' + (i + 1) + '</span>' + appIcon(a, 'rank-ph') + '<div><b>' + esc(a.name) + '</b><small>' + esc(a.category || 'App') + '</small></div></a></li>';
    }).join('');
  }

  /* ---------- apps page ---------- */
  function showApps(cat) {
    category = cat || 'all'; shown = 24; sortApps(); renderApps(); showView('v-apps');
  }
  function renderApps() {
    var cats = ['all'].concat(apps.map(function (a) { return a.category; }).filter(function (c, i, arr) { return c && arr.indexOf(c) === i; }).sort());
    $('#cat-chips').innerHTML = cats.map(function (c) { return '<button type="button" class="chip' + (c === category ? ' on' : '') + '" data-cat="' + esc(c) + '">' + (c === 'all' ? 'All' : esc(c)) + '</button>'; }).join('');
    $('#apps-title').textContent = category === 'all' ? 'All apps' : category;
    var grid = $('#apps-grid');
    if (!appsLoaded) grid.innerHTML = '<div class="empty"><b>Loading apps…</b></div>';
    else if (!sorted.length) grid.innerHTML = '<div class="empty"><b>No apps here yet</b>Check back soon, or try another category.</div>';
    else grid.innerHTML = sorted.slice(0, shown).map(appTile).join('');
    $('#apps-more').hidden = shown >= sorted.length;
  }

  /* ---------- search ---------- */
  function score(a, q) {
    var n = (a.name || '').toLowerCase(), c = (a.category || '').toLowerCase(), d = plain(a.description).toLowerCase(), dev = (a.developer || '').toLowerCase(), s = 0;
    if (n === q) s += 100; else if (n.indexOf(q) === 0) s += 60; else if (n.indexOf(q) !== -1) s += 40;
    if (c.indexOf(q) !== -1) s += 30;
    q.split(/\s+/).forEach(function (t) { if (t.length > 1) { if (n.indexOf(t) !== -1) s += 15; if (c.indexOf(t) !== -1) s += 10; if (dev.indexOf(t) !== -1) s += 8; if (d.indexOf(t) !== -1) s += 5; } });
    return s;
  }
  function findApps(q) {
    q = String(q || '').toLowerCase().trim(); if (!q) return [];
    return apps.map(function (a) { return { a: a, s: score(a, q) }; }).filter(function (x) { return x.s > 0; }).sort(function (x, y) { return y.s - x.s; }).map(function (x) { return x.a; });
  }
  function runSearch(q) {
    q = String(q || '').trim();
    var g = G(), games = g ? g.search(q, 24) : [], total = g ? g.countMatches(q) : 0, found = findApps(q);
    $('#search-title').textContent = q ? 'Results for “' + q + '”' : 'Search';
    var html = '';
    if (games.length) html += '<section class="block"><div class="block-head"><h2>Games</h2>' + (total > games.length ? '<a class="more" href="#games/' + encodeURIComponent(q) + '">See all ' + total + ' →</a>' : '') + '</div><div class="g-grid">' + games.map(function (x) { return g.tileHtml(x); }).join('') + '</div></section>';
    if (found.length) html += '<section class="block"><div class="block-head"><h2>Apps</h2></div><div class="app-grid">' + found.map(appTile).join('') + '</div></section>';
    if (!html) html = '<div class="empty"><b>' + (q ? 'Nothing found for “' + esc(q) + '”' : 'Type something to search') + '</b>Try a different word, or browse everything.<br><a class="btn outline" href="#games">Browse games</a></div>';
    $('#search-body').innerHTML = html;
    showView('v-search');
  }
  function goSearch(q) { q = String(q || '').trim(); if (!q) return; hideSuggest(); location.hash = 'search/' + encodeURIComponent(q); }

  var sel = -1;
  function hideSuggest() { var s = $('#suggest'); s.hidden = true; s.innerHTML = ''; sel = -1; }
  function showSuggest(q) {
    q = q.trim(); var s = $('#suggest'); if (!q) return hideSuggest();
    var g = G(), gm = g ? g.search(q, 4) : [], am = findApps(q).slice(0, 4), items = [];
    gm.forEach(function (x) { items.push('<button type="button" data-g="' + esc(x.id) + '"><span class="mini">' + g.coverHtml(x) + '</span>' + esc(x.name) + '<small>Game</small></button>'); });
    am.forEach(function (x) { items.push('<button type="button" data-a="' + esc(x.id) + '"><span class="mini">' + (x.img ? '<img src="' + esc(x.img) + '" alt="">' : '') + '</span>' + esc(x.name) + '<small>App</small></button>'); });
    items.push('<button type="button" data-q="1">Search all for “' + esc(q) + '”</button>');
    s.innerHTML = items.join(''); s.hidden = false; sel = -1;
  }

  /* ---------- app details ---------- */
  function openApp(id, push) {
    var a = byId(id);
    if (!a) { if (!appsLoaded) { current = null; return; } return showView('v-home'); }
    current = a;
    if (push !== false) location.hash = 'app/' + a.id;
    $('#detail-app-img').src = a.img || ''; $('#detail-app-title').textContent = a.name || '';
    $('#detail-cat').textContent = a.category || 'App';
    $('#detail-play').textContent = a.proxy_url || String(a.id).startsWith('slipstream-') ? 'Open app' : 'Play now';
    $('#detail-download').hidden = !a.download_url && !a.app_url;
    if (a.proxy_url) $('#detail-download').hidden = true;
    $('#detail-by').textContent = a.developer ? 'by ' + a.developer : '';
    $('#detail-stats').hidden = String(a.id).startsWith('slipstream-');
    $('#detail-stat-downloads').textContent = a.downloads !== undefined ? Number(a.downloads).toLocaleString() : '—';
    $('#detail-stat-filesize').textContent = a.file_size || '—'; $('#detail-stat-category').textContent = a.category || '—';
    $('#detail-stat-developer').textContent = a.developer || '—'; $('#detail-stat-submittedby').textContent = a.submitted_by || '—';
    var w = $('#detail-desc-wrapper'), c = $('#detail-desc-content'), b = $('#detail-desc-btn');
    c.innerHTML = a.description || ''; w.classList.add('clamp'); b.textContent = 'Read more'; b.hidden = true;
    showView('v-app');
    setTimeout(function () { if (c.scrollHeight > w.clientHeight + 4) b.hidden = false; else w.classList.remove('clamp'); }, 60);
    var tl = $('#versions-timeline-container'); tl.innerHTML = '';
    tl.previousElementSibling.hidden = String(a.id).startsWith('slipstream-');
    var cl = window.UBG_SUPABASE;
    if (cl) {
      Promise.resolve(cl.from('app_versions').select('*').eq('app_id', a.id).order('release_date', { ascending: false })).then(function (res) {
        if (current !== a || !res || !res.data || !res.data.length) return;
        var seen = {};
        tl.innerHTML = res.data.filter(function (v) { var k = v.version_name || v.id; if (seen[k]) return false; seen[k] = 1; return true; }).map(function (v, i) {
          return '<div><button type="button" data-ver="' + i + '">' + esc(v.version_name || '') + '</button><small>' + (v.release_date ? new Date(v.release_date).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : '') + '</small><div class="notes" id="vn-' + i + '" hidden>' + (v.changelog || '') + '</div></div>';
        }).join('');
      }).catch(function () {});
    }
    var rel = apps.filter(function (x) { return x.category === a.category && String(x.id) !== String(a.id); }).slice(0, 3);
    $('#related-apps-grid').innerHTML = rel.length ? rel.map(appTile).join('') : '<p class="muted">No related apps yet.</p>';
  }

  /* ---------- app player ---------- */
  function launchPlayer(push) {
    var a = current; if (!a) return;
    if (push !== false) {
      location.hash = 'play/' + a.id;
      return;
    }
    showView('v-player');
    window.SlipstreamAppPlayer.open(a);
  }
  function closePlayer() {
    window.SlipstreamAppPlayer.close();
  }

  /* ---------- settings ---------- */
  function renderSettings() {
    var S = window.UBG.settings, T = window.UBG.themes;
    $('#theme-grid').innerHTML = Object.keys(T).map(function (k) { var t = T[k]; return '<button type="button" class="theme-card' + (S.theme === k ? ' on' : '') + '" data-theme-key="' + k + '"><span class="prev"><i style="background:' + t.bg + '"></i><i style="background:' + t.panel + '"></i><i style="background:' + t.accent + '"></i><i style="background:' + t.accent2 + '"></i></span><b>' + t.name + '</b></button>'; }).join('');
    $('#tab-icons').innerHTML = window.UBG.icons.map(function (i) { return '<button type="button" class="icon-pick' + (S.tabIcon === i[1] ? ' on' : '') + '" data-icon="' + esc(i[1]) + '" title="' + i[0] + '" aria-label="' + i[0] + '"><img src="' + esc(i[1]) + '" alt=""></button>'; }).join('');
    $('#tab-name-input').value = S.tabName === 'Slipstream' ? '' : S.tabName;
    $('#toggle-ram-opt').checked = S.ramOpt; $('#toggle-ult-opt').checked = S.ultOpt;
    window.UBG.paintPlaytime();
  }
  function buildThemeMenus() {
    var T = window.UBG.themes, S = window.UBG.settings;
    $('#theme-pop').innerHTML = '<h3>Theme</h3><div class="theme-dots">' + Object.keys(T).map(function (k) { return '<button type="button" class="theme-dot' + (S.theme === k ? ' on' : '') + '" data-theme-key="' + k + '"><i style="background:linear-gradient(135deg,' + T[k].accent + ',' + T[k].accent2 + ')"></i>' + T[k].name + '</button>'; }).join('') + '</div>';
    $('#sheet-themes').innerHTML = Object.keys(T).map(function (k) { return '<button type="button" class="' + (S.theme === k ? 'on' : '') + '" data-theme-key="' + k + '" aria-label="' + T[k].name + '" style="background:linear-gradient(135deg,' + T[k].accent + ',' + T[k].accent2 + ')"></button>'; }).join('');
  }

  /* ---------- events ---------- */
  function bind() {
    window.addEventListener('hashchange', function () { if (!document.body.classList.contains('landing')) route(); });
    window.addEventListener('ubgenter', function () { route(); });
    window.addEventListener('ubgrecent', function () { if (!$('#v-home').hidden) renderHome(); });
    window.addEventListener('ubggames', function () { renderHome(); });
    window.addEventListener('ubgstatechange', function () { if (!$('#v-home').hidden) { var eb = $('#hero-eyebrow'); var name = window.UBGStore.get().profile.name; if (eb) eb.textContent = name && name !== 'Player' ? 'Welcome back, ' + name : ''; } });

    // top search
    var input = $('#search-input');
    $('#top-search').addEventListener('submit', function (e) { e.preventDefault(); var b = $('#suggest .sel'); if (b) return b.click(); goSearch(input.value); });
    input.addEventListener('input', function () { showSuggest(input.value); });
    input.addEventListener('keydown', function (e) {
      var items = $$('#suggest button'); if (!items.length) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length; items.forEach(function (b, i) { b.classList.toggle('sel', i === sel); }); }
      if (e.key === 'Escape') hideSuggest();
    });
    $('#suggest').addEventListener('mousedown', function (e) { e.preventDefault(); });
    $('#suggest').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.g) { hideSuggest(); input.value = ''; G().play(b.dataset.g); }
      else if (b.dataset.a) { hideSuggest(); input.value = ''; location.hash = 'app/' + b.dataset.a; }
      else goSearch(input.value);
    });
    input.addEventListener('blur', function () { setTimeout(hideSuggest, 120); });
    document.addEventListener('keydown', function (e) {
      if (e.key === '/' && document.body.classList.contains('landing') === false && !/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '') && $('#v-games').hidden) { e.preventDefault(); input.focus(); }
      if (e.key === 'Escape' && !$('#v-player').hidden && !document.fullscreenElement) closePlayer();
    });

    // hero
    $('#hero-form').addEventListener('submit', function (e) { e.preventDefault(); goSearch($('#hero-input').value); });
    $('#hero-surprise').addEventListener('click', function () { G().surprise(); });
    $('#hero-shuffle').addEventListener('click', renderCollage);

    // apps page
    $('#cat-chips').addEventListener('click', function (e) { var b = e.target.closest('.chip'); if (!b) return; var c = b.getAttribute('data-cat'); location.hash = c === 'all' ? 'apps' : 'category/' + encodeURIComponent(c); });
    $('#sort-select').addEventListener('change', function (e) { sortKey = e.target.value; shown = 24; sortApps(); renderApps(); });
    $('#apps-more').addEventListener('click', function () { shown += 24; renderApps(); });

    // details + player
    $('#app-back').addEventListener('click', function () { location.hash = 'apps'; });
    $('#detail-play').addEventListener('click', function () { launchPlayer(true); });
    $('#detail-download').addEventListener('click', function () {
      if (!current) return; var t = current.download_url || current.app_url; if (!t) return U.toast('No download available for this app');
      var a = document.createElement('a'); a.href = t; a.download = current.name || 'download'; a.target = '_blank'; document.body.appendChild(a); a.click(); a.remove();
    });
    $('#detail-desc-btn').addEventListener('click', function () { var w = $('#detail-desc-wrapper'), open = w.classList.toggle('clamp'); this.textContent = open ? 'Read more' : 'Show less'; });
    $('#versions-timeline-container').addEventListener('click', function (e) { var b = e.target.closest('[data-ver]'); if (!b) return; var n = $('#vn-' + b.getAttribute('data-ver')); if (n) n.hidden = !n.hidden; });

    // settings
    var settingsEl = $('#v-settings');
    settingsEl.addEventListener('click', function (e) {
      var th = e.target.closest('[data-theme-key]'); if (th) return window.UBG.setSiteTheme(th.getAttribute('data-theme-key'));
      var ic = e.target.closest('.icon-pick'); if (ic) { window.UBG.setTabIcon(ic.getAttribute('data-icon')); }
    });
    $('#tab-name-save').addEventListener('click', function () { window.UBG.saveTabName($('#tab-name-input').value); U.toast('Tab name saved'); });
    $('#toggle-ram-opt').addEventListener('change', function (e) { window.UBG.settings.ramOpt = e.target.checked; U.lsSet('stash_ram_opt', e.target.checked); });
    $('#toggle-ult-opt').addEventListener('change', function (e) { window.UBG.settings.ultOpt = e.target.checked; U.lsSet('stash_ult_opt', e.target.checked); });

    // theme popover + mobile sheet
    $('#btn-theme').addEventListener('click', function (e) { e.stopPropagation(); var p = $('#theme-pop'); p.hidden = !p.hidden; this.setAttribute('aria-expanded', String(!p.hidden)); });
    document.addEventListener('click', function (e) {
      var th = e.target.closest('#theme-pop [data-theme-key],#sheet-themes [data-theme-key]'); if (th) window.UBG.setSiteTheme(th.getAttribute('data-theme-key'));
      if (!e.target.closest('.theme-wrap')) { $('#theme-pop').hidden = true; $('#btn-theme').setAttribute('aria-expanded', 'false'); }
      if (e.target.closest('[data-close="sheet"]')) $('#sheet').hidden = true;
      var op = e.target.closest('[data-open]');
      if (op) { if (op.getAttribute('data-open') === 'chat') window.openCommunityChat && window.openCommunityChat(); else $('#sheet').hidden = false; }
    });
    $('#btn-chat').addEventListener('click', function () { window.openCommunityChat && window.openCommunityChat(); });
    window.addEventListener('ubgtheme', function () { buildThemeMenus(); if (!$('#v-settings').hidden) renderSettings(); });
  }

  function init() {
    buildThemeMenus(); bind(); renderHome(); renderApps();
    loadApps().then(function () { if (!document.body.classList.contains('landing')) route(); });
    if (!document.body.classList.contains('landing')) route();
  }
  document.addEventListener('DOMContentLoaded', init);
  window.UBGApp = { route: route, apps: function () { return apps; } };
})();
