import type {
  AllocationMode,
  Ingredient,
  NutrientKey,
  NutrientVector,
  NutritionStatus,
  NutritionTarget,
  Recipe,
  ShoppingItem,
} from "./types.ts";
import { nutrientKeys } from "./types.ts";

export const emptyNutrients = (): NutrientVector =>
  Object.fromEntries(nutrientKeys.map((key) => [key, 0])) as NutrientVector;

export function scaleVector(vector: NutrientVector, factor: number): NutrientVector {
  return Object.fromEntries(
    nutrientKeys.map((key) => [key, vector[key] === null ? null : vector[key] * factor]),
  ) as NutrientVector;
}

export function sumVectors(vectors: NutrientVector[]): NutrientVector {
  const result = emptyNutrients();
  for (const key of nutrientKeys) {
    if (vectors.some((vector) => vector[key] === null)) {
      result[key] = null;
      continue;
    }
    result[key] = vectors.reduce((sum, vector) => sum + (vector[key] ?? 0), 0);
  }
  return result;
}

export function calculateIngredient(ingredient: Ingredient): NutrientVector {
  const factor = (ingredient.amountG * ingredient.edibleRatio) / 100;
  return scaleVector(ingredient.food.nutrientsPer100g, factor);
}

export function calculateRecipe(recipe: Recipe): NutrientVector {
  return sumVectors(recipe.ingredients.map(calculateIngredient));
}

export function allocateRecipe(
  recipe: Recipe,
  mode: AllocationMode,
  amount: number,
): NutrientVector {
  if (amount < 0) throw new Error("实吃份量不能为负数");
  if (mode === "grams") {
    if (!recipe.finishedWeightG || recipe.finishedWeightG <= 0) {
      throw new Error("按克分配前需要填写成品重量");
    }
    if (amount > recipe.finishedWeightG) throw new Error("实吃克数不能超过成品总重量");
    return scaleVector(calculateRecipe(recipe), amount / recipe.finishedWeightG);
  }
  if (amount > recipe.yieldServings) throw new Error("实吃份数不能超过菜品出品份数");
  return scaleVector(calculateRecipe(recipe), amount / recipe.yieldServings);
}

export function getNutritionStatus(
  value: number | null,
  target: NutritionTarget,
): NutritionStatus {
  const complete = value !== null;
  const safeValue = value ?? 0;
  const percent = Math.max(0, Math.min(140, (safeValue / target.target) * 100));
  let label: NutritionStatus["label"] = "未达到参考值";
  if (!complete) label = "数据不完整";
  else if (target.upper && safeValue > target.upper) label = "超过参考上限";
  else if (target.key === "energyKcal" && safeValue >= target.target * 0.9 && safeValue <= target.target * 1.1) {
    label = "参考范围内";
  } else if (safeValue >= target.target) label = "达到参考值";
  return { ...target, value, complete, label, percent };
}

export function normalizeShoppingAmount(amount: number, unit: ShoppingItem["unit"]) {
  if (unit === "g" && amount >= 1000) return { amount: amount / 1000, unit: "kg" as const };
  if (unit === "ml" && amount >= 1000) return { amount: amount / 1000, unit: "L" as const };
  if (unit === "kg" && amount < 1) return { amount: amount * 1000, unit: "g" as const };
  if (unit === "L" && amount < 1) return { amount: amount * 1000, unit: "ml" as const };
  return { amount, unit };
}

export function formatNutrient(value: number | null, key: NutrientKey) {
  if (value === null) return "数据不足";
  if (key === "energyKcal") return `${Math.round(value)} kcal`;
  if (["sodiumMg", "calciumMg", "ironMg", "potassiumMg", "vitaminCMg"].includes(key)) {
    return `${Math.round(value)} mg`;
  }
  if (key === "vitaminDUg") return `${value.toFixed(1)} μg`;
  return `${value.toFixed(1)} g`;
}
