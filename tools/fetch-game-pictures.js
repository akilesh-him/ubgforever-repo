// Downloads one Google Image Search result per game into ../game-pictures/<game-id>.jpg
// Needs Node 18+ and a Google Programmable Search Engine (Image search ON, "Search the entire web" ON):
//   GOOGLE_API_KEY=xxxx GOOGLE_CX=yyyy node tools/fetch-game-pictures.js [maxGames]
// Free quota is 100 searches/day, so run it once a day; it skips games that already have a picture.
const fs = require('fs'), path = require('path');
global.window = {};
require('../js/games-data.js');
const ids = window.UBG_GAMES_SNAPSHOT, titles = window.UBG_GAME_TITLES || {};
const { GOOGLE_API_KEY: key, GOOGLE_CX: cx } = process.env;
if (!key || !cx) { console.error('Set GOOGLE_API_KEY and GOOGLE_CX first.'); process.exit(1); }
const out = path.join(__dirname, '..', 'game-pictures'); fs.mkdirSync(out, { recursive: true });
const max = +process.argv[2] || 100;
const missFile = path.join(__dirname, 'no-picture.json');
let misses = []; try { misses = JSON.parse(fs.readFileSync(missFile, 'utf8')); } catch (e) {}
// delete tools/no-picture.json to retry games that had no result
const nameOf = id => titles[id] || id.replace(/^cl/i, '');
(async () => {
  let done = 0;
  for (const id of ids) {
    if (done >= max) break;
    const file = path.join(out, id + '.jpg');
    if (fs.existsSync(file) || misses.includes(id)) continue;
    const q = nameOf(id) + ' game cover art';
    const api = 'https://www.googleapis.com/customsearch/v1?searchType=image&fileType=jpg&imgSize=medium&num=3&safe=active&key=' + key + '&cx=' + cx + '&q=' + encodeURIComponent(q);
    const r = await fetch(api);
    if (r.status === 429) { console.log('Daily quota reached. Run again tomorrow.'); break; }
    if (!r.ok) { console.log('API error', r.status, await r.text()); break; }
    done++;
    const items = (await r.json()).items || [];
    let saved = false;
    for (const it of items) {
      try {
        const img = await fetch(it.link, { signal: AbortSignal.timeout(10000) });
        if (!img.ok || !/image\/jpe?g/.test(img.headers.get('content-type') || '')) continue;
        fs.writeFileSync(file, Buffer.from(await img.arrayBuffer())); saved = true; break;
      } catch (e) {}
    }
    if (!saved) { misses.push(id); fs.writeFileSync(missFile, JSON.stringify(misses)); }
    console.log((saved ? 'saved   ' : 'no image ') + id + '  (' + q + ')');
  }
})();
