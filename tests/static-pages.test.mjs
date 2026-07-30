import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const outputRoot = new URL("../pages-dist/", import.meta.url);

test("creates a self-contained GitHub Pages build", async () => {
  const html = await readFile(new URL("index.html", outputRoot), "utf8");
  const assets = await readdir(new URL("assets/", outputRoot));

  assert.match(html, /Data Lumen · 表格可视化分析 Agent/);
  assert.match(html, /\/data-lumen-agent\/assets\/index-/);
  assert.doesNotMatch(html, /chatgpt\.site|\/_next\//);
  assert.ok(assets.some((name) => /^index-.*\.js$/.test(name)));
  assert.ok(assets.some((name) => /^index-.*\.css$/.test(name)));
  assert.ok(assets.some((name) => /^xlsx-.*\.js$/.test(name)));
});

test("keeps upload and analysis logic in the static application bundle", async () => {
  const assets = await readdir(new URL("assets/", outputRoot));
  const entryName = assets.find((name) => /^index-.*\.js$/.test(name));
  assert.ok(entryName);
  const entry = await readFile(new URL(`assets/${entryName}`, outputRoot), "utf8");

  assert.match(entry, /将表格拖到这里/);
  assert.match(entry, /浏览器本地分析/);
  assert.match(entry, /下载报告/);
});
