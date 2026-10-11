import { test } from "node:test";
import assert from "node:assert/strict";
import { readPages } from "./read-pages";

test("counted history preserves order with at most three concurrent reads", async () => {
  let active = 0, peak = 0;
  const rows = Array.from({ length: 17 }, (_, i) => i);
  const result = await readPages(async (offset, count) => {
    peak = Math.max(peak, ++active);
    await new Promise((resolve) => setTimeout(resolve, offset % 3));
    active--;
    return { data: rows.slice(offset, offset + 2), error: null, count: count ? rows.length : null };
  }, 2);
  assert.deepEqual(result.data, rows);
  assert.equal(peak, 3);
});

test("a failed later page discards incomplete history", async () => {
  const result = await readPages(async (offset) => ({ data: [offset, offset + 1], error: offset === 4 ? "failed" : null, count: 8 }), 2);
  assert.deepEqual(result, { data: [], error: "failed" });
});

test("empty and short histories need only one request", async () => {
  for (const rows of [[], [1]]) {
    let calls = 0;
    const result = await readPages(async () => { calls++; return { data: rows, error: null, count: rows.length }; }, 2);
    assert.deepEqual(result.data, rows);
    assert.equal(calls, 1);
  }
});

test("absent counts retain complete sequential pagination", async () => {
  const rows = [0, 1, 2, 3];
  const result = await readPages(async (offset) => ({ data: rows.slice(offset, offset + 2), error: null }), 2);
  assert.deepEqual(result.data, rows);
});
