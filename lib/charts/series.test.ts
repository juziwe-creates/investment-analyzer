import test from "node:test";
import assert from "node:assert/strict";
import { lotsInViewport, selectionRange, seriesExtent, seriesPath, visibleSamples } from "./series";
import { DAY } from "./time-viewport";

test("secondary axis fits only visible discrete events without interpolation", () => {
  const samples = [{ time: 0, value: 999 }, { time: 10, value: 2 }, { time: 20, value: 4 }, { time: 30, value: 888 }];
  const visible = visibleSamples(samples, { start: 5, end: 25 }, false, true);
  assert.deepEqual(visible.map((row) => row.value), [2, 4]);
  assert.deepEqual(seriesExtent([visible], true), { min: -.2, max: 4.2 });
  assert.deepEqual(visibleSamples(samples, { start: 11, end: 19 }, false, true), []);
});
test("cumulative series carries its last known value through a viewport", () => {
  assert.deepEqual(visibleSamples([{ time: 0, value: 100 }, { time: 10, value: 240 }, { time: 20, value: 400 }], { start: 12, end: 30 }, true), [{ time: 12, value: 240 }, { time: 20, value: 400 }, { time: 30, value: 400 }]);
});
test("unknown values are not converted to zeros or interpolated across gaps", () => {
  assert.deepEqual(visibleSamples([{ time: 0, value: null }, { time: 20, value: 4 }], { start: 5, end: 15 }), []);
  assert.deepEqual(seriesExtent([[{ time: 0, value: null }]]), { min: 0, max: 1 });
});
test("selection clamps and orders dates independently of zoom minimum", () => {
  const full = { start: 0, end: DAY * 100 };
  assert.deepEqual(selectionRange(DAY * 7, DAY * 3, full), { start: DAY * 3, end: DAY * 7 });
  assert.deepEqual(selectionRange(DAY * 3, DAY * 3, full), { start: DAY * 3, end: DAY * 3 });
  assert.deepEqual(selectionRange(-DAY, DAY * 200, full), full);
});

test("visible bar and carried cumulative maxima occupy only half plot height", () => {
  const samples = [{ time: 0, value: 999 }, { time: 10, value: 2 }, { time: 20, value: 4 }, { time: 30, value: 888 }];
  const discrete = visibleSamples(samples, { start: 5, end: 25 }, false, true);
  assert.deepEqual(seriesExtent([discrete], true, .5), { min: 0, max: 8 });
  const cumulative = visibleSamples(samples, { start: 12, end: 25 }, true);
  const extent = seriesExtent([cumulative], false, .5);
  assert.equal(extent.max, 8);
  for (const row of cumulative) assert.ok((row.value! - extent.min) / (extent.max - extent.min) <= .5);
  assert.deepEqual(seriesExtent([[{ time: 0, value: 0 }]], false, .5), { min: 0, max: 1 });
  assert.deepEqual(seriesExtent([[]], false, .5), { min: 0, max: 1 });
  assert.notDeepEqual(seriesExtent([discrete], true, .5), seriesExtent([[{ time: 10, value: 50 }]], true));
});

test("capital steps happen exactly at event timestamps; market series remain linear", () => {
  const rows = [{ time: 1, value: 100 }, { time: 5, value: 150 }, { time: 9, value: 0 }];
  assert.equal(seriesPath(rows, (v) => v, (v) => v, true), "M 1 100 H 5 V 150 H 9 V 0");
  assert.equal(seriesPath(rows, (v) => v, (v) => v), "M 1 100 L 5 150 L 9 0");
});

test("shared viewport filters inclusively before lot status without changing lot calculations", () => {
  const lots = [
    { tradeDate: "2020-01-01", remainingQuantity: 5, returnPercent: 25 },
    { tradeDate: "2022-01-01", remainingQuantity: 2, returnPercent: 100 },
    { tradeDate: "2024-12-31", remainingQuantity: 0, returnPercent: -10 },
    { tradeDate: "2025-01-01", remainingQuantity: 1, returnPercent: 5 }
  ];
  const range = { start: Date.parse("2022-01-01"), end: Date.parse("2024-12-31") };
  assert.deepEqual(lotsInViewport(lots, range, "all"), lots.slice(1, 3));
  assert.equal(lotsInViewport(lots, range, "open")[0], lots[1]);
  assert.equal(lotsInViewport(lots, range, "closed")[0], lots[2]);
  assert.equal(lotsInViewport(lots, { start: Date.parse("2023-01-01"), end: Date.parse("2023-12-31") }, "all").length, 0);
});
