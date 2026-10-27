# Game provider catalogs

The original UGS snapshot is retained. Additional verified entries are bundled in `js/provider-catalog.json`, loaded from the same origin before live UGS refresh. This avoids external catalog failures removing games. IDs are stable provider/URL hashes. The default catalog deduplicates by normalized name/ID using provider priority.

| Provider | Imported entries | Source |
| --- | ---: | --- |
| 3kh0-lite | 145 | https://github.com/3kh0/3kh0-lite/blob/main/config/games.json |
| axiom | 32 | https://github.com/Onex558/uranium-source- |
| chicken-kings-vault | 816 | https://github.com/carbonicality/ChickenKingsVault/blob/main/games.json |
| classplay | 51 | https://github.com/x8rr/cherri/tree/main/stores/ucp-games |
| elite-gamez | 322 | https://github.com/1234chromebook1234-creator/ww/blob/main/games.json |
| gn-math | 849 | https://raw.githubusercontent.com/gn-math/assets/main/zones.json |
| nebula-cdn | 3061 | https://github.com/GoatTech-42/NEBULA-CDN/blob/main/games.json |
| noahs-hub | 411 | https://github.com/Onex558/uranium-source-/blob/main/nth.js |
| seraph | 501 | https://github.com/DominumNetwork/dominum/blob/main/src/assets/libraries/seraph/games.json |
| ubg98 | 317 | https://ubg98.github.io/assets/js/games.json |

These are catalog entries, not a claim that every game was played. Relative assets resolve against the game source through an injected base element. The game proxy accepts only bundled destinations or valid UGS filenames, not arbitrary user URLs.

GN-Math uses the maintained gn-math catalogs because the supplied gn-mathfreebuisness repository was unavailable. Noah entries come from the supplied nth.js, not the unavailable Truffledaukak repository. Axiom includes verified game pages in the supplied uranium repository. The additional Axiom links name accounts rather than specific repositories and could not be resolved. Duckmath needs a complete loader URL. Supplied Cisco and Interstellar repositories were unavailable. No games are fabricated for unavailable sources.

For catalog updates, fetch the listed sources, map game names, launch URLs and optional covers, preserve stable IDs, and update counts together. Tests verify counts, uniqueness, offline loading and proxy destination restrictions.
