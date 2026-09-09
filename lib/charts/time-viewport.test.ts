import assert from "node:assert/strict";
import test from "node:test";
import { constrainRange, DAY, decimate, fullRange, parseDate, presetRange, rangeFromSearch, timestamp, zoomRange } from "./time-viewport";

const daily = Array.from({ length: 7000 }, (_, index) => timestamp("2008-01-01") + index * DAY);

test("viewport zoom and pan clamp to the entire available range", () => {
  const full = fullRange(daily);
  assert.deepEqual(zoomRange(full, 10, .5, daily), full);
  const zoom = zoomRange(full, .7, .5, daily);
  assert.ok(Math.abs((zoom.end - zoom.start) / (full.end - full.start) - .7) < .001);
  const shifted = constrainRange({ start: zoom.start - 9999 * DAY, end: zoom.end - 9999 * DAY }, daily);
  assert.equal(shifted.start, full.start);
  assert.equal(shifted.end - shifted.start, zoom.end - zoom.start);
});

test("pointer anchored zoom retains the date under the pointer", () => {
  const before = fullRange(daily);
  const after = zoomRange(before, .7, .2, daily);
  assert.ok(Math.abs(before.start + .2 * (before.end - before.start) - (after.start + .2 * (after.end - after.start))) <= DAY);
});

test("irregular observations retain at least five points through repeated zoom and pan", () => {
  const times = [0, 7, 15, 22, 40, 80, 90, 120, 125, 150].map((day) => daily[0] + day * DAY);
  let range = fullRange(times);
  for (let index = 0; index < 100; index++) {
    range = zoomRange(range, .7, (index % 10) / 10, times);
    range = constrainRange({ start: range.start + 7 * DAY, end: range.end + 7 * DAY }, times);
    assert.ok(times.filter((time) => time >= range.start && time <= range.end).length >= 5);
    assert.ok(range.start >= times[0] && range.end <= times.at(-1)!);
  }
});

test("three point and empty histories cannot zoom", () => {
  const times = daily.slice(0, 3);
  assert.deepEqual(zoomRange(fullRange(times), .01, .5, times), fullRange(times));
  assert.deepEqual(constrainRange({ start: 3, end: 5 }, []), { start: 0, end: 0 });
});

test("presets handle month ends, YTD, and limited history", () => {
  const times = Array.from({ length: 800 }, (_, index) => timestamp("2024-03-31") - (799 - index) * DAY);
  assert.equal(presetRange("1M", times).start, timestamp("2024-02-29"));
  assert.equal(presetRange("YTD", times).start, timestamp("2024-01-01"));
  assert.deepEqual(presetRange("10Y", times), fullRange(times));
});

test("URL dates must be actual dates, ordered, and within data", () => {
  assert.equal(parseDate("2024-02-30"), null);
  assert.equal(parseDate("garbage"), null);
  assert.deepEqual(rangeFromSearch(new URLSearchParams("from=2020-01-01&to=2008-01-01"), daily), fullRange(daily));
  const url = new URLSearchParams("portfolio=abc&benchmark=dax&security=a&security=b&from=2020-01-01&to=2021-01-01");
  assert.deepEqual(rangeFromSearch(url, daily), { start: timestamp("2020-01-01"), end: timestamp("2021-01-01") });
  assert.equal(url.getAll("security").length, 2);
});

test("visual decimation preserves first, last and extrema in all series without mutating data", () => {
  const rows = daily.map((time, index) => ({ time, a: index === 1250 ? 99999 : index, b: index === 4321 ? -99999 : -index }));
  const sampled = decimate(rows, (point) => [point.a, point.b], 300);
  assert.equal(sampled[0], rows[0]);
  assert.equal(sampled.at(-1), rows.at(-1));
  assert.ok(sampled.includes(rows[1250]) && sampled.includes(rows[4321]));
  assert.ok(sampled.length <= 300);
  assert.equal(rows.length, 7000);
});
