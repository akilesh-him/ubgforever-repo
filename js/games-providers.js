// Game providers registered in the Slipstream catalog. ugs library is the
// existing maintained source so its copy wins on duplicate game ids. Providers
// are listed with their documented sources, catalogs load when reachable and
// fail gracefully otherwise.
window.UBG_GAME_PROVIDERS = [
  {
    id: 'ugs',
    name: 'UGS Library',
    source: 'https://github.com/bubbls/ugs-singlefile',
    catalog:
      'https://data.jsdelivr.com/v1/packages/gh/bubbls/ugs-singlefile@main?structure=flat',
    base: 'https://cdn.jsdelivr.net/gh/bubbls/ugs-singlefile@main/UGS-Files/',
    path: 'UGS-Files/',
    pattern: /^cl[^/]+\.html$/,
    priority: 0,
  },
  {
    id: 'gn-math',
    name: 'GN-Math',
    source: 'gn-mathfreebuisness',
    catalog:
      'https://raw.githubusercontent.com/gn-mathfreebuisness/assets/main/zones.json',
    base:
      'https://raw.githubusercontent.com/gn-mathfreebuisness/assets/main/freebuisness/html/',
    covers:
      'https://raw.githubusercontent.com/gn-mathfreebuisness/assets/main/freebuisness/covers/',
    path: 'freebuisness/html',
    priority: 1,
  },
  {
    id: 'duckmath',
    name: 'Duckmath',
    source: 'Bitbucket script loader',
    catalog: null,
    base: null,
    priority: 2,
  },
  {
    id: 'axiom',
    name: 'Axiom',
    source:
      'https://github.com/Onex558/uranium-source- https://github.com/Mathisfunallfiles https://github.com/retro-games- https://github.com/Ultimate-games-stash-games-',
    catalog: null,
    base: null,
    priority: 3,
  },
  {
    id: 'noahs-hub',
    name: "Noah's Hub",
    source: 'https://github.com/Onex558/uranium-source-',
    catalog:
      'https://raw.githubusercontent.com/Truffledaukak/truffled/main/g.json',
    base: null,
    priority: 4,
  },
  {
    id: '3kh0-lite',
    name: '3kh0 Lite',
    source: 'https://github.com/3kh0/3kh0-lite',
    catalog:
      'https://raw.githubusercontent.com/3kh0/3kh0-lite/main/games.json',
    base: null,
    priority: 5,
  },
  {
    id: 'nebula-cdn',
    name: 'Nebula CDN',
    source: 'https://github.com/GoatTech-42/NEBULA-CDN',
    catalog: null,
    base: null,
    priority: 6,
  },
  {
    id: 'classplay',
    name: 'ClassPlay',
    source: 'https://github.com/x8rr/cherri',
    catalog: null,
    base: null,
    priority: 7,
  },
  {
    id: 'ubg98',
    name: 'UBG98',
    source: 'https://ubg98.github.io/',
    catalog: null,
    base: null,
    priority: 8,
  },
  {
    id: 'cisco',
    name: 'Cisco',
    source: 'https://github.com/PeteZah-Games/PeteZahGamesUbg',
    catalog: null,
    base: null,
    priority: 9,
  },
  {
    id: 'useinterstellar',
    name: 'UseInterstellar',
    source: 'https://github.com/Interstellar-Assets/Interstellar-Assets',
    catalog: null,
    base: null,
    priority: 10,
  },
  {
    id: 'seraph',
    name: 'Seraph',
    source:
      'https://github.com/DominumNetwork/dominum https://github.com/a456pur/seraph',
    catalog: null,
    base: null,
    priority: 11,
  },
  {
    id: 'elite-gamez',
    name: 'Elite Gamez',
    source: 'https://github.com/1234chromebook1234-creator/ww',
    catalog: null,
    base: null,
    priority: 12,
  },
  {
    id: 'chicken-kings-vault',
    name: 'Chicken Kings Vault',
    source: 'https://github.com/carbonicality/ChickenKingsVault',
    catalog: null,
    base: null,
    priority: 13,
  },
];
