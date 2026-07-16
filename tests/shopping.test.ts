import assert from "node:assert/strict";
import test from "node:test";
import { convertShoppingAmount, generateShoppingFromMeals } from "../app/lib/shopping.ts";
import type { Meal, NutrientVector, Recipe, ShoppingItem } from "../app/lib/types.ts";

const emptyNutrition = Object.fromEntries(["energyKcal", "proteinG", "fatG", "carbohydrateG", "fiberG", "sodiumMg", "calciumMg", "ironMg", "potassiumMg", "vitaminCMg", "vitaminDUg"].map((key) => [key, 0])) as NutrientVector;
const recipe: Recipe = {
  id: "recipe",
  name: "测试菜",
  description: "",
  favorite: false,
  yieldServings: 2,
  finishedWeightG: 500,
  tags: [],
  updatedAt: "",
  ingredients: [
    { id: "tomato", amountG: 300, edibleRatio: 1, food: { id: "tomato", name: "番茄", aliases: [], state: "raw", nutrientsPer100g: emptyNutrition, source: "custom", sourceVersion: "test" } },
    { id: "oil", amountG: 20, edibleRatio: 1, food: { id: "oil", name: "食用油", aliases: [], state: "packaged", nutrientsPer100g: emptyNutrition, source: "custom", sourceVersion: "test" } },
  ],
};
const meal: Meal = {
  id: "meal",
  date: "2026-07-16",
  slot: "lunch",
  status: "planned",
  time: "12:00",
  participantIds: ["m1", "m2"],
  dishes: [{ id: "dish", recipeId: recipe.id, recipeSnapshot: recipe, allocationMode: "servings", allocations: { m1: 0.5, m2: 1 } }],
};

test("generates and merges ingredient amounts from menu allocations", () => {
  const existing: ShoppingItem[] = [
    { id: "old-tomato", name: "番茄", amount: 1, unit: "kg", checked: true, source: "generated" },
    { id: "manual-milk", name: "牛奶", amount: 2, unit: "L", checked: false, source: "manual" },
  ];
  const result = generateShoppingFromMeals([meal, { ...meal, id: "outside", date: "2026-07-20" }], "2026-07-16", "2026-07-18", existing);
  assert.equal(result.mealCount, 1);
  assert.equal(result.generatedCount, 2);
  assert.deepEqual(result.items.find((item) => item.name === "番茄"), { id: "old-tomato", name: "番茄", amount: 225, unit: "g", checked: true, source: "generated" });
  assert.equal(result.items.find((item) => item.name === "食用油")?.amount, 15);
  assert.equal(result.items.find((item) => item.name === "牛奶")?.source, "manual");
});

test("supports finished-weight allocations and validates the date range", () => {
  const gramsMeal: Meal = { ...meal, dishes: [{ ...meal.dishes[0], allocationMode: "grams", allocations: { m1: 100, m2: 150 } }] };
  const result = generateShoppingFromMeals([gramsMeal], "2026-07-16", "2026-07-16", []);
  assert.equal(result.items.find((item) => item.name === "番茄")?.amount, 150);
  assert.throws(() => generateShoppingFromMeals([], "2026-07-18", "2026-07-16", []), /结束日期/);
});

test("converts compatible shopping units without changing unrelated units", () => {
  assert.equal(convertShoppingAmount(1500, "g", "kg"), 1.5);
  assert.equal(convertShoppingAmount(1.25, "L", "ml"), 1250);
  assert.equal(convertShoppingAmount(3, "包", "盒"), 3);
});
