import assert from "node:assert/strict";
import test from "node:test";
import { addDays, formatPageDate, formatWeekRange, getWeekDateKeys, startOfWeek } from "../app/lib/date.ts";

test("builds a Monday-to-Sunday selector around the chosen date", () => {
  assert.equal(startOfWeek("2026-07-16"), "2026-07-13");
  assert.deepEqual(getWeekDateKeys("2026-07-16"), [
    "2026-07-13",
    "2026-07-14",
    "2026-07-15",
    "2026-07-16",
    "2026-07-17",
    "2026-07-18",
    "2026-07-19",
  ]);
});

test("moves dates correctly across month and year boundaries", () => {
  assert.equal(addDays("2026-07-31", 1), "2026-08-01");
  assert.equal(addDays("2026-01-01", -1), "2025-12-31");
});

test("formats the week selected by the user", () => {
  assert.equal(formatWeekRange("2026-07-16"), "7月13日—7月19日");
  assert.match(formatPageDate("2026-07-16"), /2026年7月16日.*星期四/);
});
