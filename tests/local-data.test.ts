import assert from "node:assert/strict";
import test from "node:test";
import { memberProfileSchema } from "../app/lib/app-schemas.ts";
import { createLocalBackup, parseLocalBackup, parseLocalData } from "../app/lib/local-data.ts";
import type { LocalDataBundle } from "../app/lib/local-data.ts";

const data: LocalDataBundle = {
  householdName: "温暖的家",
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
  assert.equal(restored.householdName, "温暖的家");
  assert.equal(restored.meals.length, 0);
});

test("adds a default household name when loading older browser data", () => {
  const legacyData: Partial<LocalDataBundle> = { ...data };
  delete legacyData.householdName;
  assert.equal(parseLocalData(JSON.stringify(legacyData)).householdName, "我的家庭");
});

test("rejects unrelated or incomplete browser data", () => {
  assert.throws(() => parseLocalBackup(JSON.stringify({ version: 1 })));
  assert.throws(() => parseLocalData(JSON.stringify({ members: [] })));
});

test("validates and converts editable member profile fields", () => {
  const result = memberProfileSchema.safeParse({
    name: "安然",
    relation: "我",
    birthday: "1991-04-16",
    driSex: "female",
    heightCm: "165.5",
    weightKg: "57.6",
    activity: "medium",
    goal: "maintain",
  });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.heightCm, 165.5);
    assert.equal(result.data.weightKg, 57.6);
  }
  assert.equal(memberProfileSchema.safeParse({ name: "安然", relation: "我", birthday: "1991-04-16", driSex: "female", heightCm: 0, weightKg: 57.6, activity: "medium", goal: "maintain" }).success, false);
});
