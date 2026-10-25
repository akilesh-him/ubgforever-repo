import { readdir, readFile, cp, mkdir, rm, access } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
for (const directory of ["js", "tools", "tests", "."]) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isFile() || !/\.(m?js|cjs)$/.test(entry.name)) continue;
    const result = spawnSync(
      process.execPath,
      ["--check", resolve(directory, entry.name)],
      { encoding: "utf8" },
    );
    if (result.status !== 0) throw new Error(result.stderr);
    const filename = resolve(directory, entry.name);
    const source = await readFile(filename, "utf8");
    for (const match of source.matchAll(
      /(?:from\s*|import\s*\(\s*)["'](\.{1,2}\/[^"']+)["']/g,
    )) {
      await access(resolve(dirname(filename), match[1]));
    }
  }
}
const page = await readFile("index.html", "utf8");
for (const match of page.matchAll(
  /<(?:script|link)\b[^>]*(?:src|href)=["']([^"']+)["']/g,
)) {
  if (!/^(?:https?:|\/\/|#)/.test(match[1])) await access(resolve(match[1]));
}
await rm("dist", { recursive: true, force: true });
await mkdir("dist");
for (const entry of [
  "index.html",
  "sw.js",
  "css",
  "js",
  "img",
  "apps",
  "game-pictures",
])
  await cp(entry, "dist/" + entry, { recursive: true });
for (const [name, path] of Object.entries({
  scramjet: "scramjet",
  baremux: "bare-mux",
  epoxy: "epoxy-transport",
}))
  await cp("node_modules/@mercuryworkshop/" + path + "/dist", "dist/" + name, {
    recursive: true,
  });
console.log(
  "Build complete. Public assets validated and copied; AI and Wisp require npm start.",
);
