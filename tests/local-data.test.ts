import assert from "node:assert/strict";
import test from "node:test";
import { createLocalBackup, parseLocalBackup, parseLocalData } from "../app/lib/local-data.ts";
import type { LocalDataBundle } from "../app/lib/local-data.ts";

const data: LocalDataBundle = {
  members: [{
    id: "member-1",
    name: "测试成员",
    relation: "我",
    avatar: "测",
    managed: false,
    healthShared: true,
    birthday: "1990-01-01",
    driSex: "female",
    heightCm: 165,
    weightKg: 55,
    activity: "medium",
    goal: "maintain",
    allergies: [],
  }],
  recipes: [],
  meals: [],
  shopping: [],
  vitals: [],
};

test("round-trips a static-site backup", () => {
  const restored = parseLocalBackup(createLocalBackup(data));
  assert.equal(restored.members[0].name, "测试成员");
  assert.equal(restored.meals.length, 0);
});

test("rejects unrelated or incomplete browser data", () => {
  assert.throws(() => parseLocalBackup(JSON.stringify({ version: 1 })));
  assert.throws(() => parseLocalData(JSON.stringify({ members: [] })));
});
