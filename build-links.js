// Regenerates js/links-data.js from links/*.txt (only needed for opening index.html via file://)
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, 'links'), data = {};
fs.readdirSync(dir).filter(f => f.endsWith('.txt')).sort().forEach(f => data['links/' + f] = fs.readFileSync(path.join(dir, f), 'utf8'));
fs.writeFileSync(path.join(__dirname, 'js', 'links-data.js'), '/* Auto-generated from /links/*.txt for file:// use. Regenerate with: node build-links.js */\nwindow.UBG_LINKS_DATA = ' + JSON.stringify(data) + ';\n');
console.log('wrote js/links-data.js');
