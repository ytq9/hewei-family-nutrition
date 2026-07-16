import assert from "node:assert/strict";
import test from "node:test";
import {
  allocateRecipe,
  calculateIngredient,
  calculateRecipe,
  getNutritionStatus,
  normalizeShoppingAmount,
  sumVectors,
} from "../app/lib/nutrition.ts";
import type { FoodItem, NutrientVector, Recipe } from "../app/lib/types.ts";

const nutrients = (energy: number | null, protein: number | null, fat = 0, carbohydrate = 0): NutrientVector => ({
  energyKcal: energy,
  proteinG: protein,
  fatG: fat,
  carbohydrateG: carbohydrate,
  fiberG: 0,
  sodiumMg: 0,
  calciumMg: 0,
  ironMg: 0,
  potassiumMg: 0,
  vitaminCMg: 0,
  vitaminDUg: 0,
});

const food: FoodItem = {
  id: "test-food",
  name: "测试食材",
  aliases: [],
  state: "raw",
  nutrientsPer100g: nutrients(200, 10),
  source: "custom",
  sourceVersion: "test",
};

const recipe: Recipe = {
  id: "test-recipe",
  name: "测试菜谱",
  description: "",
  favorite: false,
  yieldServings: 2,
  finishedWeightG: 300,
  ingredients: [{ id: "ingredient", food, amountG: 200, edibleRatio: 0.75 }],
  tags: [],
  updatedAt: "test",
};

test("calculates edible weight instead of treating gross weight as consumed", () => {
  const result = calculateIngredient(recipe.ingredients[0]);
  assert.equal(result.energyKcal, 300);
  assert.equal(result.proteinG, 15);
});

test("recalculates energy and all three macronutrients after recipe editing", () => {
  const editedRecipe = structuredClone(recipe);
  editedRecipe.ingredients[0].food.nutrientsPer100g = nutrients(220, 14, 8, 16);
  const result = calculateRecipe(editedRecipe);
  assert.equal(result.energyKcal, 330);
  assert.equal(result.proteinG, 21);
  assert.equal(result.fatG, 12);
  assert.equal(result.carbohydrateG, 24);
});

test("allocates recipe by servings and by finished grams", () => {
  assert.equal(calculateRecipe(recipe).energyKcal, 300);
  assert.equal(allocateRecipe(recipe, "servings", 1).energyKcal, 150);
  assert.equal(allocateRecipe(recipe, "grams", 100).energyKcal, 100);
  assert.throws(() => allocateRecipe({ ...recipe, finishedWeightG: undefined }, "grams", 50), /成品重量/);
  assert.throws(() => allocateRecipe(recipe, "servings", 3), /出品份数/);
});

test("never converts missing nutrient data to zero", () => {
  const result = sumVectors([nutrients(100, 5), nutrients(50, null)]);
  assert.equal(result.energyKcal, 150);
  assert.equal(result.proteinG, null);
  assert.equal(getNutritionStatus(result.proteinG, { key: "proteinG", target: 50 }).label, "数据不完整");
});

test("applies energy range and upper limit labels", () => {
  assert.equal(getNutritionStatus(95, { key: "energyKcal", target: 100 }).label, "参考范围内");
  assert.equal(getNutritionStatus(2100, { key: "sodiumMg", target: 1500, upper: 2000 }).label, "超过参考上限");
});

test("normalizes shopping units without changing count units", () => {
  assert.deepEqual(normalizeShoppingAmount(1500, "g"), { amount: 1.5, unit: "kg" });
  assert.deepEqual(normalizeShoppingAmount(750, "ml"), { amount: 750, unit: "ml" });
  assert.deepEqual(normalizeShoppingAmount(2, "盒"), { amount: 2, unit: "盒" });
});
