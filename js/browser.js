/* Browser tab = the Rammerhead proxy itself, full size. Links come from js/proxy-links.js. */
(function(){
  const SRV_KEY = 'ubg_browser_server_v2';
  const $ = id => document.getElementById(id);
  const hostOf = u => String(u || '').trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '').toLowerCase();
  const servers = () => [...new Set((window.UBG_PROXY_LINKS || []).map(hostOf).filter(Boolean))];

  let host = null, dead = {}, started = false, token = 0;
  try { host = localStorage.getItem(SRV_KEY) || null; } catch(e){}

  const timeout = ms => { const c = new AbortController(); setTimeout(() => c.abort(), ms); return c.signal; };
  // no-cors fetch resolves when the server answers, rejects on DNS/TLS/network failure
  const probe = h => fetch('https://' + h + '/', { mode: 'no-cors', cache: 'no-store', signal: timeout(4500) }).then(() => h);
  const alive = h => !dead[h] || Date.now() - dead[h] > 60000;

  async function pickServer(){
    if (host && servers().includes(host) && alive(host)) { try { await probe(host); return host; } catch(e){ dead[host] = Date.now(); } }
    const list = servers().filter(alive);
    for (let i = 0; i < list.length; i += 5) {
      const res = await Promise.allSettled(list.slice(i, i + 5).map(probe));
      const hit = res.find(r => r.status === 'fulfilled');
      if (hit) { host = hit.value; try { localStorage.setItem(SRV_KEY, host); } catch(e){} return host; }
    }
    dead = {};
    return null;
  }

  function status(msg, showSwitch){
    const s = $('ubgb-status'); if (!s) return;
    s.hidden = !msg;
    s.querySelector('span').textContent = msg || '';
    $('ubgb-switch').hidden = !showSwitch;
  }

  async function load(){
    const frame = $('ubgb-frame'); if (!frame) return;
    const my = ++token;
    status('Finding a working server…');
    const h = await pickServer();
    if (my !== token) return;
    if (!h) return status('No server answered. Check your connection.', true);
    let done = false;
    const next = () => { if (done || my !== token) return; done = true; dead[h] = Date.now(); load(); };
    frame.onload = () => { if (done || my !== token) return; done = true; status(''); };
    setTimeout(next, 15000);
    frame.src = 'https://' + h + '/';
  }

  function init(){
    const root = $('browser-root'); if (!root) return;
    if (!root.dataset.ready) {
      root.dataset.ready = '1';
      root.innerHTML = `<div class="ubgb-win">
        <iframe id="ubgb-frame" title="Browser" allow="fullscreen; autoplay; clipboard-read; clipboard-write; gamepad; microphone; camera" referrerpolicy="no-referrer"></iframe>
        <div class="ubgb-status" id="ubgb-status" hidden><span></span><button type="button" id="ubgb-switch" hidden>Try another server</button></div>
      </div>`;
      $('ubgb-switch').onclick = () => { if (host) dead[host] = Date.now(); load(); };
    }
    if (!started) { started = true; load(); }
  }

  window.openBrowserPage = function(){
    window.location.hash = 'browser';
    if (typeof showView === 'function') showView('v-browser');
  };
  window.UBGBrowserInit = init;
})();
