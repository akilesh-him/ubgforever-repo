(() => {
  let peer = null;
  let hostPeer = null;
  let isHost = false;
  let roomCode = '';
  let connections = new Map();
  let joined = false;
  let lastSend = 0;

  // Local-only identity: this survives page refreshes on the same browser.
  const STORAGE_NAME = 'ubg_chat_name';
  const STORAGE_ID = 'ubg_chat_user_id';
  const getUserId = () => {
    let id = localStorage.getItem(STORAGE_ID);
    if (!id) {
      id = (crypto.randomUUID ? crypto.randomUUID() : 'user-' + Math.random().toString(36).slice(2) + Date.now().toString(36));
      localStorage.setItem(STORAGE_ID, id);
    }
    return id;
  };
  const $ = id => document.getElementById(id);

  // ---------- Saved chat history (stored only in this browser) ----------
  const HIST_KEY = 'ubg_chat_history_v1';
  const SAVE_ON_KEY = 'ubg_chat_save_enabled';
  const MAX_PER_ROOM = 300, MAX_ROOMS = 25;
  let historyShown = false;
  const saveEnabled = () => localStorage.getItem(SAVE_ON_KEY) !== '0';
  const readAll = () => { try { return JSON.parse(localStorage.getItem(HIST_KEY) || '{}') || {}; } catch { return {}; } };
  const writeAll = db => {
    try {
      const codes = Object.keys(db).sort((a, b) => (db[b].updated || 0) - (db[a].updated || 0));
      codes.slice(MAX_ROOMS).forEach(c => delete db[c]);
      localStorage.setItem(HIST_KEY, JSON.stringify(db));
    } catch {}
  };
  const saveMessage = msg => {
    if (!roomCode || !saveEnabled()) return;
    const db = readAll();
    const room = db[roomCode] || (db[roomCode] = { created: Date.now(), msgs: [] });
    room.msgs.push({ id: msg.id, userId: msg.userId, name: msg.name, text: String(msg.text || '').slice(0, 500), time: msg.time || Date.now() });
    if (room.msgs.length > MAX_PER_ROOM) room.msgs = room.msgs.slice(-MAX_PER_ROOM);
    room.updated = Date.now();
    writeAll(db);
    renderSavedList();
  };
  const getRoomHistory = code => (readAll()[code]?.msgs) || [];
  const deleteRoomHistory = code => { const db = readAll(); delete db[code]; writeAll(db); renderSavedList(); };
  const fmtLine = m => `[${new Date(m.time).toLocaleString()}] ${m.name || 'Guest'}: ${m.text}`;
  const downloadRoom = async code => {
    const msgs = await getMergedHistory(code);
    if (!msgs.length) { setStatus('Nothing saved for that room yet.'); return; }
    const text = `UBGForever chat - room ${code}\nSaved ${new Date().toLocaleString()}\n\n` + msgs.map(fmtLine).join('\n') + '\n';
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = `ubg-chat-${code}.txt`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  const escHtml = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  // ---------- Supabase (shared history) ----------
  const seen = new Set();                       // message ids already on screen
  let cloudWarned = false;
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, ch => { const r = Math.random() * 16 | 0; return (ch === 'x' ? r : (r & 3 | 8)).toString(16); }));
  const client = () => window.UBG_SUPABASE || null;
  const cloudWarn = err => {
    console.warn('Chat history (Supabase):', err);
    if (cloudWarned) return; cloudWarned = true;
    const missing = err && (err.code === 'PGRST202' || err.code === '42883' || /could not find the function/i.test(err.message || ''));
    setStatus(missing ? 'Cloud history isn\u2019t set up yet (run supabase-chat.sql). Saving on this device only.' : 'Cloud history unavailable right now. Saving on this device only.');
  };
  async function cloudPost(msg) {
    const c = client(); if (!c || !saveEnabled() || !roomCode || !msg.id) return;
    try {
      const { error } = await c.rpc('post_chat_message', { p_id: msg.id, p_room: roomCode, p_user: msg.userId, p_name: msg.name, p_body: String(msg.text).slice(0, 500) });
      if (error) cloudWarn(error);
    } catch (e) { cloudWarn(e); }
  }
  async function cloudFetch(code) {
    const c = client(); if (!c) return [];
    try {
      const { data, error } = await c.rpc('get_chat_messages', { p_room: code, p_limit: 300 });
      if (error) { cloudWarn(error); return []; }
      return (data || []).map(r => ({ id: r.id, userId: r.user_id, name: r.name, text: r.body, time: new Date(r.created_at).getTime() }));
    } catch (e) { cloudWarn(e); return []; }
  }
  // Local copy + shared copy, de-duplicated and in time order.
  async function getMergedHistory(code) {
    const all = [...getRoomHistory(code), ...(await cloudFetch(code))];
    const byKey = new Map();
    all.forEach(m => { const k = m.id || `${m.userId}|${m.time}|${m.text}`; if (!byKey.has(k) || m.id) byKey.set(k, m); });
    return [...byKey.values()].sort((a, b) => a.time - b.time).slice(-300);
  }

  function renderSavedList() {
    const box = $('community-chat-saved'); if (!box) return;
    const db = readAll();
    const codes = Object.keys(db).filter(c => db[c].msgs?.length).sort((a, b) => (db[b].updated || 0) - (db[a].updated || 0));
    const on = saveEnabled();
    box.innerHTML = `
      <label class="ccs-toggle"><input type="checkbox" id="ccs-enable" ${on ? 'checked' : ''}> Save chat history (cloud + this device)</label>
      <div class="ccs-title">Saved chats</div>` +
      (codes.length ? codes.map(c => `
        <div class="ccs-row" data-code="${escHtml(c)}">
          <div class="ccs-info"><b>${escHtml(c)}</b><small>${db[c].msgs.length} message${db[c].msgs.length === 1 ? '' : 's'} · ${escHtml(new Date(db[c].updated || 0).toLocaleDateString())}</small></div>
          <button type="button" data-act="view">View</button>
          <button type="button" data-act="rejoin">Rejoin</button>
          <button type="button" data-act="download">.txt</button>
          <button type="button" data-act="delete" class="ccs-del" aria-label="Delete saved chat">✕</button>
        </div>`).join('') : '<p class="ccs-empty">No saved chats yet. Messages you send or receive are saved here automatically.</p>');
  }

  async function showViewer(code) {
    const box = $('community-chat-saved'); if (!box) return;
    box.innerHTML = '<p class="ccs-empty">Loading…</p>';
    const msgs = await getMergedHistory(code);
    box.innerHTML = `
      <div class="ccs-viewer-head"><button type="button" data-act="back">← Back</button><b>Room ${escHtml(code)}</b><button type="button" data-act="download-v" data-code="${escHtml(code)}">Download .txt</button></div>
      <div class="ccs-viewer">${msgs.map(m => `<div class="ccs-msg"><div class="ccs-meta">${escHtml(m.name || 'Guest')} • ${escHtml(new Date(m.time).toLocaleString([], {dateStyle:'short', timeStyle:'short'}))}</div><div>${escHtml(m.text)}</div></div>`).join('')}</div>`;
  }

  async function loadHistoryOnce() {
    if (historyShown || !roomCode) return;
    historyShown = true;
    const code = roomCode;
    const msgs = (await getMergedHistory(code)).filter(m => !(m.id && seen.has(m.id)));
    if (code !== roomCode || !msgs.length) return;     // user left / nothing to show
    const box = $('community-chat-messages');
    const first = box && box.firstChild;
    const frag = document.createDocumentFragment();
    const hold = document.createElement('div');
    const sys = t => { const el = document.createElement('div'); el.className = 'community-chat-system'; el.textContent = t; return el; };
    frag.appendChild(sys('Earlier messages in this room (saved history):'));
    msgs.forEach(m => {
      if (m.id) seen.add(m.id);
      const wrap = document.createElement('div');
      wrap.className = 'community-chat-message' + (m.userId === getUserId() ? ' mine' : '');
      const meta = document.createElement('div'); meta.className = 'meta';
      meta.textContent = `${m.name || 'Guest'} \u2022 ${new Date(m.time).toLocaleString([], {dateStyle:'short', timeStyle:'short'})}`;
      const body = document.createElement('div'); body.className = 'body'; body.textContent = String(m.text || '').slice(0, 500);
      wrap.append(meta, body); frag.appendChild(wrap);
    });
    frag.appendChild(sys('\u2014 end of saved history \u2014'));
    if (box) { box.insertBefore(frag, first); box.scrollTop = box.scrollHeight; }
  }

  function wireSavedUi() {
    const setup = $('community-chat-setup');
    if (setup && !$('community-chat-saved')) {
      const div = document.createElement('div');
      div.id = 'community-chat-saved'; div.className = 'community-chat-saved';
      setup.appendChild(div);
      div.addEventListener('click', e => {
        const btn = e.target.closest('button[data-act]'); if (!btn) return;
        const act = btn.dataset.act, code = btn.closest('.ccs-row')?.dataset.code || btn.dataset.code;
        if (act === 'view') showViewer(code);
        else if (act === 'back') renderSavedList();
        else if (act === 'download' || act === 'download-v') downloadRoom(code);
        else if (act === 'delete') { if (confirm(`Remove room ${code} from this device? Cloud history is kept.`)) deleteRoomHistory(code); }
        else if (act === 'rejoin') { if ($('community-chat-room')) $('community-chat-room').value = code; window.joinCommunityRoom(); }
      });
      div.addEventListener('change', e => {
        if (e.target.id === 'ccs-enable') { localStorage.setItem(SAVE_ON_KEY, e.target.checked ? '1' : '0'); setStatus(e.target.checked ? 'Chat history will be saved.' : 'Chat saving is off.'); }
      });
    }
    const bar = document.querySelector('.community-chat-room-bar');
    if (bar && !$('ccs-bar-save')) {
      const dl = document.createElement('button');
      dl.type = 'button'; dl.id = 'ccs-bar-save'; dl.textContent = 'Save .txt';
      dl.onclick = () => downloadRoom(roomCode);
      const clr = document.createElement('button');
      clr.type = 'button'; clr.textContent = 'Clear my copy'; clr.title = 'Removes the copy on this device. Cloud history is kept.';
      clr.onclick = () => { if (roomCode && confirm('Delete this device\u2019s saved copy of the room? Cloud history is kept.')) { deleteRoomHistory(roomCode); setStatus('Local copy cleared. Cloud history is kept.'); } };
      bar.append(dl, clr);
    }
    const note = document.querySelector('.community-chat-note');
    if (note) note.textContent = 'Live messages go directly between browsers. When saving is on, messages are also stored in the UBGForever database under the room code, so anyone who has the code can load the room\u2019s history later. Don\u2019t share private info. The person who creates the room still needs to stay connected for it to stay live.';
    renderSavedList();
  }
  const cleanName = () => {
    const name = (($('community-chat-name')?.value || localStorage.getItem(STORAGE_NAME) || 'Guest').trim().slice(0, 24));
    return name || 'Guest';
  };
  const saveIdentity = () => {
    const name = cleanName();
    localStorage.setItem(STORAGE_NAME, name);
    getUserId();
    if ($('community-chat-name')) $('community-chat-name').value = name;
    return name;
  };
  const setStatus = text => { const el = $('community-chat-status'); if (el) el.textContent = text; };
  const addSystem = text => {
    const box = $('community-chat-messages'); if (!box) return;
    const el = document.createElement('div');
    el.className = 'community-chat-system';
    el.textContent = text;
    box.appendChild(el);
    box.scrollTop = box.scrollHeight;
  };
  const addMessage = (msg, mine = false, persist = true) => {
    const box = $('community-chat-messages'); if (!box) return;
    const wrap = document.createElement('div');
    wrap.className = 'community-chat-message' + (mine ? ' mine' : '');
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = `${msg.name || 'Guest'} • ${new Date(msg.time || Date.now()).toLocaleTimeString([], {hour:'numeric', minute:'2-digit'})}`;
    const body = document.createElement('div');
    body.className = 'body';
    body.textContent = String(msg.text || '').slice(0, 500);
    wrap.append(meta, body);
    box.appendChild(wrap);
    box.scrollTop = box.scrollHeight;
    if (msg.id) seen.add(msg.id);
    if (persist) saveMessage(msg);
  };
  const showRoom = code => {
    $('community-chat-setup')?.classList.add('hidden');
    $('community-chat-room-ui')?.classList.remove('hidden');
    if ($('community-chat-room-code')) $('community-chat-room-code').textContent = code;
    loadHistoryOnce();
  };

  // The host acts as the lightweight relay. Any number of connected peers
  // can use the same room (limited by the browser/network, not the UI).
  const sendToAll = msg => connections.forEach(c => {
    if (c && c.open) {
      try { c.send({type:'message', ...msg}); } catch {}
    }
  });
  const sendToAllExcept = (peerId, msg) => connections.forEach((c, id) => {
    if (id !== peerId && c.open) {
      try { c.send({type:'message', ...msg}); } catch {}
    }
  });

  window.openCommunityChat = () => {
    const modal = $('community-chat-modal'); if (!modal) return;
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    const saved = localStorage.getItem(STORAGE_NAME);
    if (saved && $('community-chat-name')) $('community-chat-name').value = saved;
    getUserId();
    wireSavedUi();
    setStatus('Create or join a room to chat.');
    setTimeout(() => $('community-chat-name')?.focus(), 50);
  };

  window.closeCommunityChat = () => {
    const modal = $('community-chat-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.setAttribute('aria-hidden', 'true');
    }
  };

  window.createCommunityRoom = () => {
    if (!window.Peer) { setStatus('The peer connection library could not load.'); return; }
    saveIdentity();
    if (peer) { try { peer.destroy(); } catch {} }

    // The first user is the room host/relay.
    roomCode = Math.random().toString(36).slice(2, 8).toUpperCase();
    isHost = true;
    joined = false;
    historyShown = false;
    peer = new Peer('ubg-' + roomCode, {debug: 0});

    peer.on('open', id => {
      joined = true;
      if ($('community-chat-room')) $('community-chat-room').value = roomCode;
      showRoom(roomCode);
      setStatus('Room is ready. Share the code with as many people as you want.');
      addSystem('You created the room. Keep this tab open while the room is active.');
    });

    peer.on('connection', conn => setupConnection(conn, true));
    peer.on('error', err => {
      if (err?.type === 'unavailable-id') {
        setStatus('That room code was already taken. Creating another…');
        setTimeout(window.createCommunityRoom, 250);
      } else {
        setStatus('Connection error. Try creating a new room.');
      }
    });
  };

  window.joinCommunityRoom = () => {
    if (!window.Peer) { setStatus('The peer connection library could not load.'); return; }
    saveIdentity();
    const code = (($('community-chat-room')?.value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, ''));
    if (code.length < 4) { setStatus('Enter a valid room code.'); return; }

    if (peer) { try { peer.destroy(); } catch {} }
    roomCode = code;
    isHost = false;
    joined = false;
    historyShown = false;
    hostPeer = 'ubg-' + code;
    peer = new Peer(undefined, {debug: 0});

    peer.on('open', () => {
      const conn = peer.connect(hostPeer, {reliable: true});
      setupConnection(conn, false);
    });
    peer.on('error', err => {
      setStatus(err?.type === 'peer-unavailable'
        ? 'Room not found. Check the code and try again.'
        : 'Could not join the room.');
    });
  };

  function setupConnection(conn, hostSide) {
    if (!conn) return;
    connections.set(conn.peer, conn);

    conn.on('open', () => {
      joined = true;
      showRoom(roomCode);
      setStatus(isHost
        ? `${connections.size} user${connections.size === 1 ? '' : 's'} connected.`
        : 'Connected to the room.');

      if (hostSide) {
        try {
          conn.send({type:'welcome', users: connections.size});
        } catch {}
        addSystem('Someone joined the room.');
      } else {
        addSystem('Connected. Messages are sent directly between browsers.');
      }
    });

    conn.on('data', data => {
      if (!data || typeof data !== 'object') return;

      if (data.type === 'message') {
        if (data.id && seen.has(data.id)) return;   // already shown (e.g. loaded from history)
        // Show once on the receiving browser.
        addMessage(data, false);

        // Host relays it to every other participant.
        if (isHost) sendToAllExcept(conn.peer, data);
      }
    });

    conn.on('close', () => {
      connections.delete(conn.peer);
      if (isHost) {
        setStatus(`${connections.size} user${connections.size === 1 ? '' : 's'} connected.`);
        addSystem('Someone left the room.');
      }
    });

    conn.on('error', () => {
      connections.delete(conn.peer);
    });
  }

  window.sendCommunityMessage = e => {
    e.preventDefault();
    if (!joined) { setStatus('Join a room first.'); return; }

    const input = $('community-chat-input');
    const text = (input?.value || '').trim();
    if (!text) return;

    const now = Date.now();
    if (now - lastSend < 700) { setStatus('Slow down a little.'); return; }
    lastSend = now;

    const name = saveIdentity();
    const msg = {
      type: 'message',
      id: uuid(),
      userId: getUserId(),
      name,
      text: text.slice(0, 500),
      time: now
    };

    addMessage(msg, true);
    cloudPost(msg);

    if (isHost) {
      sendToAll(msg);
    } else {
      // Non-hosts have one connection: the host.
      connections.forEach(c => {
        if (c.open) {
          try { c.send(msg); } catch {}
        }
      });
    }

    input.value = '';
    input.focus();
  };

  window.copyCommunityRoomCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setStatus('Room code copied.');
    } catch {
      setStatus(`Room code: ${roomCode}`);
    }
  };

  window.leaveCommunityRoom = () => {
    connections.forEach(c => { try { c.close(); } catch {} });
    connections.clear();
    if (peer) { try { peer.destroy(); } catch {} }
    peer = null;
    joined = false;
    isHost = false;
    roomCode = '';
    historyShown = false;
    $('community-chat-room-ui')?.classList.add('hidden');
    $('community-chat-setup')?.classList.remove('hidden');
    if ($('community-chat-messages')) $('community-chat-messages').innerHTML = '';
    setStatus('You left the room.');
    renderSavedList();
  };

  // Make sure the saved nickname is restored whenever the chat UI exists.
  document.addEventListener('DOMContentLoaded', () => {
    getUserId();
    const saved = localStorage.getItem(STORAGE_NAME);
    if (saved && $('community-chat-name')) $('community-chat-name').value = saved;
    wireSavedUi();
  });

  // Small public API (handy for debugging / other scripts)
  window.UBGChatSaved = { get: getRoomHistory, remove: deleteRoomHistory, download: downloadRoom, all: readAll };
})();
