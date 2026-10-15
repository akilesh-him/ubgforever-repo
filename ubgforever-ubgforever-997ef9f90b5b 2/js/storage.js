(function () {
  const KEY = 'ubgforever_repo_state_v1';
  const defaults = {
    profile: { name: 'Player', bio: 'Ready to play.', level: 1, xp: 0, streak: 0 },
    favorites: [],
    history: [],
    collections: [],
    friends: [],
    activity: [],
    requests: [],
    achievements: [],
    settings: { compact: false, reducedMotion: false, dynamicBg: true, accent: 'violet' },
    lastVisit: null
  };
  function clone(v){ return JSON.parse(JSON.stringify(v)); }
  function load(){ try { const raw=localStorage.getItem(KEY); return raw ? Object.assign(clone(defaults), JSON.parse(raw)) : clone(defaults); } catch(e){ return clone(defaults); } }
  let state=load();
  function save(){ try { localStorage.setItem(KEY, JSON.stringify(state)); } catch(e){}; window.dispatchEvent(new CustomEvent('ubgstatechange',{detail:state})); }
  window.UBGStore={
    get(){ return state; }, save,
    reset(){ state=clone(defaults); save(); return state; },
    patch(part, value){ state[part]=value; save(); return state[part]; },
    addHistory(name){ if(!name)return; state.history=[{name,time:Date.now()},...state.history.filter(x=>x.name!==name)].slice(0,30); state.profile.xp += 10; state.profile.level=1+Math.floor(state.profile.xp/250); save(); },
    toggleFavorite(name){ const i=state.favorites.indexOf(name); if(i>=0) state.favorites.splice(i,1); else state.favorites.push(name); save(); return !~i; },
    addCollection(name){ if(name && !state.collections.includes(name)) state.collections.push(name); save(); },
    addActivity(text){ state.activity=[{text,time:Date.now()},...state.activity].slice(0,50); save(); },
    export(){ return JSON.stringify(state,null,2); },
    import(raw){ const parsed=JSON.parse(raw); state=Object.assign(clone(defaults),parsed); save(); return state; },
    key:KEY
  };
})();
