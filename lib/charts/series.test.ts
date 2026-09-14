import test from "node:test";
import assert from "node:assert/strict";
import { selectionRange, seriesExtent, visibleSamples } from "./series";
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
