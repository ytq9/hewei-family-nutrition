import assert from "node:assert/strict";
import test from "node:test";
import { createRecipeFile, createRecipeTemplate, parseRecipeFile } from "../app/lib/recipe-file.ts";

test("imports the standard recipe JSON format with complete nutrient fields", () => {
  const recipe = parseRecipeFile(createRecipeTemplate());
  assert.equal(recipe.name, "示例菜名");
  assert.equal(recipe.ingredients.length, 1);
  assert.equal(recipe.ingredients[0].food.nutrientsPer100g.sodiumMg, null);
  assert.equal(recipe.ingredients[0].food.nutrientsPer100g.fiberG, null);
});

test("round-trips micronutrients when exporting and importing a recipe", () => {
  const recipe = parseRecipeFile(createRecipeTemplate());
  recipe.ingredients[0].food.nutrientsPer100g = {
    ...recipe.ingredients[0].food.nutrientsPer100g,
    fiberG: 2.4,
    sodiumMg: 12,
    calciumMg: 35,
    ironMg: 1.2,
    potassiumMg: 230,
  };
  const restored = parseRecipeFile(createRecipeFile(recipe));
  assert.equal(restored.ingredients[0].food.nutrientsPer100g.fiberG, 2.4);
  assert.equal(restored.ingredients[0].food.nutrientsPer100g.calciumMg, 35);
  assert.equal(restored.ingredients[0].food.nutrientsPer100g.potassiumMg, 230);
});

test("rejects executable text, wrong formats, and invalid nutrient values", () => {
  assert.throws(() => parseRecipeFile("alert('no')"), /JSON/);
  assert.throws(() => parseRecipeFile(JSON.stringify({ format: "other", version: 1, recipe: {} })), /格式不正确/);
  const invalid = JSON.parse(createRecipeTemplate());
  invalid.recipe.ingredients[0].nutrientsPer100g.sodiumMg = -1;
  assert.throws(() => parseRecipeFile(JSON.stringify(invalid)), /格式不正确/);
});
