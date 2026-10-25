(function(){
  // Groups map to the files in /links. Add a new file here to get a new dropdown.
  const GROUPS = [
    { name: 'Re:Vault',   file: 'links/Re:Vault.txt' },
    { name: 'HyperZHub',  file: 'links/HyperZHub.txt' },
    { name: 'Galaxy v7',  file: 'links/Galaxy v7.txt' }
  ];
  const cache = {};

  function parse(text){
    const seen = new Set();
    return String(text || '').split(/\r?\n/).map(l => l.trim())
      .filter(l => l && !l.startsWith('#') && /^https?:\/\//i.test(l))
      .filter(l => !seen.has(l) && seen.add(l));
  }

  async function load(group){
    if (cache[group.file]) return cache[group.file];
    let links = null;
    try {
      const res = await fetch(encodeURI(group.file).replace(/:/g, '%3A'), { cache: 'no-cache' });
      if (!res.ok) throw new Error(res.status);
      links = parse(await res.text());
    } catch (e) {
      // fetch is blocked when index.html is opened straight from disk (file://)
      const fallback = window.UBG_LINKS_DATA && window.UBG_LINKS_DATA[group.file];
      if (fallback) links = parse(fallback);
    }
    return (cache[group.file] = links);
  }

  function host(u){ try { return new URL(u).hostname.replace(/^www\./,''); } catch(e){ return u; } }
  const esc = s => (window.UBGUI ? UBGUI.escapeHtml(s) : String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));

  function render(){
    const root = document.getElementById('links-groups');
    if (!root || root.dataset.ready) return;
    root.dataset.ready = '1';
    root.innerHTML = GROUPS.map((g, i) => `
      <section class="ubg-links-group" data-i="${i}">
        <button type="button" class="ubg-links-head" aria-expanded="false" aria-controls="ubg-links-body-${i}">
          <span class="ubg-links-name">${esc(g.name)}</span>
          <span class="ubg-links-count" id="ubg-links-count-${i}">…</span>
          <svg class="ubg-links-chev" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <div class="ubg-links-body" id="ubg-links-body-${i}" hidden></div>
      </section>`).join('');

    GROUPS.forEach((g, i) => load(g).then(l => {
      const c = document.getElementById('ubg-links-count-' + i);
      if (c) c.textContent = l ? l.length + ' links' : 'unavailable';
    }));

    root.addEventListener('click', async e => {
      const head = e.target.closest('.ubg-links-head');
      if (!head) return;
      const sec = head.parentElement, i = +sec.dataset.i, body = sec.querySelector('.ubg-links-body');
      const open = head.getAttribute('aria-expanded') === 'true';
      head.setAttribute('aria-expanded', String(!open));
      sec.classList.toggle('open', !open);
      body.hidden = open;
      if (open || body.dataset.filled) return;
      body.innerHTML = '<p class="ubg-links-msg">Loading…</p>';
      const links = await load(GROUPS[i]);
      if (!links) { body.innerHTML = '<p class="ubg-links-msg">Couldn\u2019t load this collection. Try refreshing the page.</p>'; return; }
      body.dataset.filled = '1';
      body.innerHTML = '<input type="search" class="ubg-links-filter" placeholder="Filter ' + links.length + ' links…" aria-label="Filter links">' +
        '<ul class="ubg-links-list">' + links.map(u => `<li><a href="${esc(u)}" target="_blank" rel="noopener noreferrer"><span>${esc(host(u))}</span><small>${esc(u)}</small></a></li>`).join('') + '</ul>';
    });
    root.addEventListener('input', e => {
      if (!e.target.classList.contains('ubg-links-filter')) return;
      const q = e.target.value.trim().toLowerCase();
      e.target.parentElement.querySelectorAll('li').forEach(li => { li.hidden = q && !li.textContent.toLowerCase().includes(q); });
    });
  }

  window.UBGLinksRender = render;
  window.openLinksPage = function(){
    window.location.hash = 'links';
    if (typeof showView === 'function') showView('links-page-view');
    render();
  };
  window.addEventListener('DOMContentLoaded', render);
  render();
})();
