/* UBGForever profile: level, library, friends, challenges, customization and tools. */
(function () {
  'use strict';
  var U = window.UBGUI, store = window.UBGStore, esc = U.escapeHtml, toast = U.toast, fmt = U.formatTime;
  var root = null, tab = 'overview';
  var TABS = ['Overview', 'Profile', 'Library', 'Social', 'Challenges', 'Customize', 'Tools', 'Updates'];

  function state() { return store.get(); }
  function download(name, data, type) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type: type })); a.download = name; a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 500);
  }
  function applySettings() {
    var s = state().settings || {};
    document.body.classList.toggle('compact', !!s.compact);
    document.documentElement.classList.toggle('reduce-motion', !!s.reducedMotion);
  }
  function achievements() {
    var s = state();
    return [s.history.length >= 1 && 'First launch', s.history.length >= 5 && 'Getting started', s.favorites.length >= 5 && 'Curator', s.collections.length >= 1 && 'Collector', s.profile.xp >= 500 && 'XP hunter'].filter(Boolean);
  }
  function uniqueToday() { return new Set(state().history.filter(function (x) { return Date.now() - x.time < 86400000; }).map(function (x) { return x.name; })).size; }
  function row(left, right) { return '<div class="p-row"><span>' + left + '</span>' + (right || '') + '</div>'; }
  function empty(t) { return '<p>' + t + '</p>'; }

  var panels = {
    overview: function () {
      var s = state(), xp = s.profile.xp || 0, lvl = s.profile.level || 1;
      var rec = (s.history.length ? s.history.map(function (x) { return x.name; }) : []);
      rec = rec.filter(function (n, i) { return rec.indexOf(n) === i; }).slice(0, 5);
      var counts = s.history.reduce(function (a, x) { a[x.name] = (a[x.name] || 0) + 1; return a; }, {});
      var top = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })[0];
      return '<div class="p-grid">' +
        '<div class="p-card"><span class="p-pill">Level ' + lvl + '</span><div class="p-stat">' + xp + ' XP</div><div class="p-meter"><i style="width:' + ((xp % 250) / 250 * 100) + '%"></i></div><p style="margin-top:10px">' + (250 - (xp % 250)) + ' XP until the next level.</p></div>' +
        '<div class="p-card"><h3>Favorites</h3><div class="p-stat">' + s.favorites.length + '</div><p>Games you marked to revisit.</p></div>' +
        '<div class="p-card"><h3>Play history</h3><div class="p-stat">' + s.history.length + '</div><p>Recent games tracked on this device.</p></div>' +
        '<div class="p-card wide"><h3>Play again</h3><div class="p-list">' + (rec.map(function (n) { return row(esc(n), '<span class="p-pill">Recent</span>'); }).join('') || empty('Play a few games and they will show up here.')) + '</div></div>' +
        '<div class="p-card"><h3>Top game</h3><p>' + (top ? esc(top) + ': ' + counts[top] + ' play' + (counts[top] === 1 ? '' : 's') + '.' : 'Start playing to build mastery.') + '</p></div>' +
        '<div class="p-card"><h3>Daily challenge</h3><p>Play 3 different games today: ' + Math.min(uniqueToday(), 3) + '/3</p></div></div>';
    },
    profile: function () {
      var s = state();
      return '<div class="p-grid"><div class="p-card wide"><h3>Player profile</h3>' +
        '<label class="p-label">Name<input class="input" id="p-name" maxlength="40" value="' + esc(s.profile.name) + '"></label>' +
        '<div class="p-picture-field"><span class="p-label">Profile picture</span><input id="p-avatar" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Profile picture" aria-describedby="p-picture-status" hidden><button class="p-btn p-picture-upload" id="p-picture-choose" type="button">Choose picture</button><p class="muted" id="p-picture-status">JPG, PNG or WebP · Saved on this browser</p></div>' +
        '<label class="p-label">Bio<input class="input" id="p-bio" value="' + esc(s.profile.bio) + '"></label>' +
        '<div class="p-actions"><button class="p-btn primary" id="p-save" type="button">Save profile</button><button class="p-btn" id="p-export" type="button">Export profile</button></div></div>' +
        '<div class="p-card"><h3>Streak</h3><div class="p-stat">' + (s.profile.streak || 0) + ' days</div><p>Your local play streak.</p></div>' +
        '<div class="p-card"><h3>Achievements</h3><div class="p-stat">' + achievements().length + '</div><p>Milestones unlock automatically.</p></div></div>';
    },
    library: function () {
      var s = state();
      return '<div class="p-grid">' +
        '<div class="p-card wide"><h3>Favorites</h3><div class="p-list">' + (s.favorites.map(function (n) { return row(esc(n), '<button class="p-btn" data-remove="' + esc(n) + '" type="button">Remove</button>'); }).join('') || empty('No favorites yet. Tap the star on any game.')) + '</div></div>' +
        '<div class="p-card wide"><h3>Recent history</h3><div class="p-list">' + (s.history.slice(0, 12).map(function (x) { return row(esc(x.name), '<small>' + fmt(x.time) + '</small>'); }).join('') || empty('No play history yet.')) + '</div></div>' +
        '<div class="p-card"><h3>Collections</h3><input class="input" id="p-coll" placeholder="New collection"><div class="p-actions"><button class="p-btn primary" id="p-coll-add" type="button">Create</button></div>' +
        '<div class="p-list">' + (s.collections.map(function (c) { return row(esc(c)); }).join('') || empty('No collections yet.')) + '</div></div></div>';
    },
    social: function () {
      var s = state();
      return '<div class="p-grid">' +
        '<div class="p-card"><h3>Friends</h3><input class="input" id="p-friend" placeholder="Friend name"><div class="p-actions"><button class="p-btn primary" id="p-friend-add" type="button">Add friend</button></div><div class="p-list">' + (s.friends.map(function (x) { return row(esc(x)); }).join('') || empty('Your friend list is empty.')) + '</div></div>' +
        '<div class="p-card"><h3>Leaderboard</h3><div class="p-actions"><button class="p-btn" id="p-leaderboard" type="button">View top ten</button></div></div>' +
        '<div class="p-card"><h3>Activity</h3><div class="p-list">' + (s.activity.slice(0, 8).map(function (x) { return row(esc(x.text), '<small>' + fmt(x.time) + '</small>'); }).join('') || empty('No activity yet.')) + '</div></div></div>';
    },
    challenges: function () {
      var s = state(), ach = achievements();
      return '<div class="p-grid"><div class="p-card wide"><h3>Challenges</h3><div class="p-list">' +
        row('Play 3 different games today', '<b>' + Math.min(uniqueToday(), 3) + '/3</b>') + row('Reach 50 XP', '<b>' + Math.min(s.profile.xp, 50) + '/50</b>') + '</div></div>' +
        window.SlipstreamLeaderboard.panel() + '<div class="p-card wide"><h3>Achievements</h3><div class="p-list">' + (ach.map(function (a) { return row(esc(a), '<span class="p-pill">Unlocked</span>'); }).join('') || empty('Keep playing to unlock achievements.')) + '</div></div></div>';
    },
    customize: function () {
      var s = state(), st = s.settings || {};
      return '<div class="p-grid"><div class="p-card wide"><h3>Theme</h3><p>Choose a color theme for the whole site.</p><div class="theme-grid">' +
        Object.keys(window.UBG.themes).map(function (k) { var t = window.UBG.themes[k]; return '<button type="button" class="theme-card' + (window.UBG.settings.theme === k ? ' on' : '') + '" data-theme-key="' + k + '"><span class="prev"><i style="background:' + t.bg + '"></i><i style="background:' + t.panel + '"></i><i style="background:' + t.accent + '"></i><i style="background:' + t.accent2 + '"></i></span><b>' + t.name + '</b></button>'; }).join('') + '</div></div>' +
        '<div class="p-card"><h3>Interface</h3><label class="p-check"><input type="checkbox" id="p-compact" ' + (st.compact ? 'checked' : '') + '> Compact layout</label><label class="p-check"><input type="checkbox" id="p-motion" ' + (st.reducedMotion ? 'checked' : '') + '> Reduced motion</label></div>' +
        '<div class="p-card"><h3>Share your setup</h3><p>Export your interface settings, or import a file from another install.</p><div class="p-actions"><button class="p-btn" id="p-theme-export" type="button">Export</button><button class="p-btn" id="p-theme-import" type="button">Import</button></div><input type="file" id="p-theme-file" accept="application/json" hidden></div></div>';
    },
    tools: function () {
      var used = 0; try { used = JSON.stringify(localStorage).length; } catch (e) {}
      return '<div class="p-grid">' +
        '<div class="p-card"><h3>Diagnostics</h3><p>Viewport: ' + innerWidth + ' × ' + innerHeight + '</p><p>Storage: ' + (used / 1024).toFixed(1) + ' KB used on this device.</p><div class="p-actions"><button class="p-btn" id="p-diag" type="button">Run check</button></div></div>' +
        '<div class="p-card"><h3>Performance</h3><p>Run a short device computation check.</p><div class="p-actions"><button class="p-btn" id="p-perf" type="button">Run test</button></div><p id="p-perf-out"></p></div>' +
        '<div class="p-card"><h3>Data</h3><p>Back up or restore your local profile.</p><div class="p-actions"><button class="p-btn" id="p-data-export" type="button">Export</button><button class="p-btn" id="p-data-import" type="button">Import</button><button class="p-btn" id="p-data-reset" type="button">Reset</button></div><input type="file" id="p-data-file" accept="application/json" hidden></div>' +
        '<div class="p-card wide"><h3>Request a game</h3><input class="input" id="p-request" placeholder="Name of a game you want added"><div class="p-actions"><button class="p-btn primary" id="p-request-send" type="button">Submit request</button></div></div></div>';
    },
    updates: function () {
      return '<div class="p-grid"><div class="p-card wide"><h3>Slipstream</h3><div class="p-list">' +
        row('Floating glass taskbar', '') + row('Game artwork, favorites and recents', '') +
        row('Eight color themes', '') + row('Search across games and apps', '') + '</div></div></div>';
    }
  };

  function wire(el) {
    var s = state(), q = function (id) { return el.querySelector('#' + id); };
    var on = function (id, fn) { var n = q(id); if (n) n.onclick = fn; };
    on('p-save', function () { s.profile.name = q('p-name').value.trim() || 'Player'; s.profile.bio = q('p-bio').value.trim();  store.save(); toast('Profile saved'); render(); });
    var upload = q('p-avatar');
    on('p-picture-choose', function () { upload.click(); });
    if (upload) upload.onchange = async function () {
      var file = upload.files[0];
      if (!file) return;
      var button = q('p-picture-choose');
      button.disabled = true;
      try {
        var pictures = await import('./profile-picture.mjs');
        var image = await pictures.prepareProfilePicture(file);
        if (!upload.isConnected) return;
        s.profile.name = q('p-name').value.trim() || 'Player';
        s.profile.bio = q('p-bio').value.trim();
        s.profile.avatarUrl = image;
        if (!store.save()) throw new Error('Browser storage is full or unavailable. Your picture could not be saved.');
        toast('Profile picture updated');
      } catch (error) {
        toast(error.message || 'Could not load this picture');
      } finally {
        button.disabled = false;
        upload.value = '';
      }
    };
    on('p-leaderboard', function () { tab = 'challenges'; render(); });
    on('p-export', function () { download('ubg-profile.json', store.export(), 'application/json'); });
    el.querySelectorAll('[data-remove]').forEach(function (b) { b.onclick = function () { store.toggleFavorite(b.getAttribute('data-remove')); render(); }; });
    on('p-coll-add', function () { var v = q('p-coll').value.trim(); if (v) { store.addCollection(v); toast('Collection created'); render(); } });
    on('p-friend-add', function () { var v = q('p-friend').value.trim(); if (v && s.friends.indexOf(v) === -1) { s.friends.push(v); store.addActivity('Added ' + v + ' as a friend'); store.save(); toast('Friend added'); render(); } });
    el.querySelectorAll('[data-theme-key]').forEach(function (b) { b.onclick = function () { window.UBG.setSiteTheme(b.getAttribute('data-theme-key')); }; });
    var c = q('p-compact'), m = q('p-motion');
    if (c) c.onchange = function (e) { s.settings.compact = e.target.checked; store.save(); applySettings(); };
    if (m) m.onchange = function (e) { s.settings.reducedMotion = e.target.checked; store.save(); applySettings(); };
    on('p-theme-export', function () { download('ubg-settings.json', JSON.stringify(s.settings, null, 2), 'application/json'); });
    on('p-theme-import', function () { q('p-theme-file').click(); });
    var tf = q('p-theme-file'); if (tf) tf.onchange = function (e) { var f = e.target.files[0]; if (!f) return; var r = new FileReader(); r.onload = function () { try { s.settings = Object.assign(s.settings, JSON.parse(r.result)); store.save(); applySettings(); render(); toast('Settings imported'); } catch (_) { toast('Invalid settings file'); } }; r.readAsText(f); };
    on('p-diag', function () {
      var unavailable = [];
      if (!navigator.serviceWorker) unavailable.push('Browser needs localhost or HTTPS');
      if (typeof WebSocket === 'undefined') unavailable.push('WebSocket is unavailable');
      try {
        var key = 'slipstream-storage-check';
        localStorage.setItem(key, 'ready');
        if (localStorage.getItem(key) !== 'ready') unavailable.push('Storage is unavailable');
        localStorage.removeItem(key);
      } catch (error) {
        unavailable.push('Storage is unavailable');
      }
      toast(unavailable.length ? unavailable.join('. ') : 'Browser and device storage are available');
    });
    on('p-perf', function () { var t0 = performance.now(), n = 0; for (var i = 0; i < 300000; i++) n += Math.sqrt(i); q('p-perf-out').textContent = 'Benchmark: ' + (performance.now() - t0).toFixed(1) + ' ms'; });
    on('p-data-export', function () { download('ubgforever-data.json', store.export(), 'application/json'); });
    on('p-data-import', function () { q('p-data-file').click(); });
    var df = q('p-data-file'); if (df) df.onchange = function (e) { var f = e.target.files[0]; if (!f) return; var r = new FileReader(); r.onload = function () { try { store.import(r.result); render(); toast('Data imported'); } catch (_) { toast('Invalid backup file'); } }; r.readAsText(f); };
    on('p-data-reset', function () { if (confirm('Reset your profile, favorites and history on this device?')) { store.reset(); render(); toast('Profile reset'); } });
    on('p-request-send', function () { var v = q('p-request').value.trim(); if (v) { store.addActivity('Requested game: ' + v); q('p-request').value = ''; toast('Request saved. Thanks!'); } });
  }

  function render() {
    root = root || document.getElementById('v-profile'); if (!root) return;
    var s = state(), xp = s.profile.xp || 0, lvl = s.profile.level || 1;
    var avatar = /^(https:\/\/|data:image\/(webp|png|jpeg);base64,)/i.test(s.profile.avatarUrl || '')
      ? '<img src="' + esc(s.profile.avatarUrl) + '" alt="" referrerpolicy="no-referrer">'
      : esc((s.profile.name || 'P').charAt(0).toUpperCase());
    root.innerHTML =
      '<div class="p-hero"><div class="p-avatar">' + avatar + '</div><div><p class="eyebrow">Level ' + lvl + '</p><h1>' + esc(s.profile.name) + '</h1><p class="muted">' + esc(s.profile.bio === 'Ready to play.' ? '' : (s.profile.bio || '')) + '</p><div class="p-meter"><i style="width:' + ((xp % 250) / 250 * 100) + '%"></i></div></div></div>' +
      '<div class="p-tabs" role="tablist">' + TABS.map(function (t) { var k = t.toLowerCase(); return '<button type="button" role="tab" id="p-tab-' + k + '" aria-controls="p-panel" tabindex="' + (k === tab ? 0 : -1) + '" aria-selected="' + (k === tab) + '" class="p-tab' + (k === tab ? ' on' : '') + '" data-tab="' + k + '">' + t + '</button>'; }).join('') + '</div>' +
      '<div id="p-panel" role="tabpanel" aria-labelledby="p-tab-' + tab + '">' + panels[tab]() + '</div>';
    root.querySelectorAll('.p-tab').forEach(function (button, index) {
      button.onclick = function () {
        tab = button.getAttribute('data-tab');
        render();
        root.querySelector('.p-tab[aria-selected="true"]').focus();
      };
      button.onkeydown = function (event) {
        var next;
        if (event.key === 'ArrowRight') next = (index + 1) % TABS.length;
        if (event.key === 'ArrowLeft') next = (index + TABS.length - 1) % TABS.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = TABS.length - 1;
        if (next === undefined) return;
        event.preventDefault();
        tab = TABS[next].toLowerCase();
        render();
        root.querySelector('.p-tab[aria-selected="true"]').focus();
      };
    });
    var panel = root.querySelector('#p-panel');
    wire(panel);
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches && !document.body.classList.contains('effects-reduced') && !document.documentElement.classList.contains('reduce-motion')) {
      panel.animate([{ opacity: .5, transform: 'translateY(5px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 220, easing: 'ease-out' });
    }
    if (tab === 'challenges') window.SlipstreamLeaderboard.mount();
    window.dispatchEvent(new CustomEvent('ubgtheme-refresh'));
  }

  window.addEventListener('ubgstatechange', function () { if (root && !root.hidden) render(); });
  window.addEventListener('ubgtheme', function () { if (root && !root.hidden && tab === 'customize') render(); });
  document.addEventListener('DOMContentLoaded', applySettings);
  window.UBGProfile = { render: render, applySettings: applySettings };
})();
