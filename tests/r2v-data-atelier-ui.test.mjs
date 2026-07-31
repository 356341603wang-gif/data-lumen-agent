import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const css = await readFile(
  new URL("../app/globals.css", import.meta.url),
  "utf8",
);

test("uses the approved Data Atelier palette and evidence-track motif", () => {
  for (const token of [
    "--atelier-paper: #f1f0ea",
    "--atelier-ink: #10110f",
    "--atelier-acid: #b9f52b",
    "--atelier-warning: #f1a73b",
    "--atelier-danger: #ee6b55",
  ]) {
    assert.match(
      css.toLowerCase(),
      new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
  }
  assert.match(css, /\.evidence-track/);
  assert.match(css, /prefers-reduced-motion/);
});
