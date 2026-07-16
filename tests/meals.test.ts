import assert from "node:assert/strict";
import test from "node:test";
import { addOrMergeMeal, mergeMealsByDateAndSlot } from "../app/lib/meals.ts";
import type { Meal, NutrientVector, Recipe } from "../app/lib/types.ts";

const nutrients = Object.fromEntries(["energyKcal", "proteinG", "fatG", "carbohydrateG", "fiberG", "sodiumMg", "calciumMg", "ironMg", "potassiumMg", "vitaminCMg", "vitaminDUg"].map((key) => [key, 0])) as NutrientVector;
const recipe = (id: string): Recipe => ({
  id,
  name: id,
  description: "",
  favorite: false,
  yieldServings: 2,
  tags: [],
  updatedAt: "",
  ingredients: [{ id: `ingredient-${id}`, amountG: 100, edibleRatio: 1, food: { id: `food-${id}`, name: id, aliases: [], state: "raw", nutrientsPer100g: nutrients, source: "custom", sourceVersion: "test" } }],
});
const meal = (id: string, slot: Meal["slot"], recipeId: string, status: Meal["status"] = "planned"): Meal => ({
  id,
  date: "2026-07-16",
  slot,
  status,
  time: slot === "lunch" ? "12:00" : "18:00",
  participantIds: id === "meal-a" ? ["m1"] : ["m2"],
  dishes: [{ id: "dish", recipeId, recipeSnapshot: recipe(recipeId), allocationMode: "servings", allocations: { m1: 1, m2: 1 } }],
});

test("groups dishes from the same date and meal slot into one meal", () => {
  const grouped = mergeMealsByDateAndSlot([meal("meal-a", "dinner", "soup", "confirmed"), meal("meal-b", "dinner", "rice", "planned"), meal("meal-c", "lunch", "noodles")]);
  assert.equal(grouped.length, 2);
  const dinner = grouped.find((item) => item.slot === "dinner");
  assert.equal(dinner?.dishes.length, 2);
  assert.deepEqual(dinner?.participantIds, ["m1", "m2"]);
  assert.equal(dinner?.status, "planned");
  assert.equal(new Set(dinner?.dishes.map((dish) => dish.id)).size, 2);
});

test("adds a new dish to an existing meal slot instead of adding another meal", () => {
  const result = addOrMergeMeal([meal("meal-a", "dinner", "soup")], meal("meal-b", "dinner", "rice"));
  assert.equal(result.length, 1);
  assert.deepEqual(result[0].dishes.map((dish) => dish.recipeId), ["soup", "rice"]);
});
