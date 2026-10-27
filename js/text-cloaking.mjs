const letters = {
  a: 'á', b: 'ḅ', c: 'ç', d: 'ď', e: '3', f: 'ƒ', g: 'ğ',
  h: 'ĥ', i: 'í', j: 'ĵ', k: 'ķ', l: 'ľ', m: 'ṁ', n: 'ñ',
  o: 'ó', p: 'ṕ', q: 'q', r: 'ř', s: 'š', t: 'ť', u: 'ú',
  v: 'ṽ', w: 'ŵ', x: 'ẋ', y: 'ý', z: 'ž',
};

export function cloakText(text) {
  return text.replace(/[a-z]/gi, letter => {
    const replacement = letters[letter.toLowerCase()];
    return letter === letter.toUpperCase() ? replacement.toUpperCase() : replacement;
  });
}

export function mountTextCloaking(root, toggle) {
  const key = 'slipstream-text-cloaking';
  const originals = new WeakMap();
  const excluded = 'script,style,textarea,input,pre,code,svg,#landing,[contenteditable]:not([contenteditable="false"]),[data-text-cloak-control]';
  let enabled = false;
  try { enabled = localStorage.getItem(key) === 'true'; } catch {}
  toggle.checked = enabled;

  function update(node) {
    if (!node.parentElement || node.parentElement.closest(excluded)) return;
    const previous = originals.get(node);
    const raw = previous && node.data === previous.rendered ? previous.raw : node.data;
    const rendered = enabled ? cloakText(raw) : raw;
    if (rendered !== node.data) node.data = rendered;
    originals.set(node, { raw, rendered });
  }

  function visit(node) {
    if (node.nodeType === 3) return update(node);
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) update(walker.currentNode);
  }

  const observer = new MutationObserver(records => {
    observer.disconnect();
    for (const record of records) {
      if (record.type === 'characterData') update(record.target);
      else for (const node of record.addedNodes) visit(node);
    }
    observe();
  });
  function observe() { observer.observe(root, { childList: true, characterData: true, subtree: true }); }
  function render() { observer.disconnect(); visit(root); observe(); }

  toggle.onchange = () => {
    enabled = toggle.checked;
    try { localStorage.setItem(key, String(enabled)); }
    catch { window.UBGUI.toast('This setting could not be saved on this device.'); }
    render();
  };
  render();
  return { dispose() { enabled = false; observer.disconnect(); visit(root); } };
}
