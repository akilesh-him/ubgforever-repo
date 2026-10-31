import { copyFile, mkdir } from 'node:fs/promises';

const packages = {
  scramjet: { source: 'scramjet', files: ['scramjet.all.js', 'scramjet.sync.js', 'scramjet.wasm.wasm'] },
  baremux: { source: 'bare-mux', files: ['index.js', 'worker.js'] },
  epoxy: { source: 'epoxy-transport', files: ['index.mjs'] },
};

for (const [directory, { source, files }] of Object.entries(packages)) {
  await mkdir(directory, { recursive: true });
  for (const file of files)
    await copyFile(`node_modules/@mercuryworkshop/${source}/dist/${file}`, `${directory}/${file}`);
}
await copyFile('node_modules/@mercuryworkshop/scramjet/LICENSE', 'scramjet/LICENSE');
await copyFile('node_modules/@mercuryworkshop/bare-mux/LICENSE', 'baremux/LICENSE');
