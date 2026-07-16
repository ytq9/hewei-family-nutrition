import { z } from "zod";
import { nutrientKeys } from "./types.ts";
import type { NutrientVector, Recipe } from "./types";

const nutrientValueSchema = z.number().finite().nonnegative().nullable().optional();
const importedNutrientsSchema = z.object({
  energyKcal: nutrientValueSchema,
  proteinG: nutrientValueSchema,
  fatG: nutrientValueSchema,
  carbohydrateG: nutrientValueSchema,
  fiberG: nutrientValueSchema,
  sodiumMg: nutrientValueSchema,
  calciumMg: nutrientValueSchema,
  ironMg: nutrientValueSchema,
  potassiumMg: nutrientValueSchema,
  vitaminCMg: nutrientValueSchema,
  vitaminDUg: nutrientValueSchema,
}).strict();

const recipeFileSchema = z.object({
  format: z.literal("hewei-recipe"),
  version: z.literal(1),
  recipe: z.object({
    name: z.string().trim().min(1).max(40),
    description: z.string().max(2_000).optional().default(""),
    yieldServings: z.number().finite().positive().max(50),
    finishedWeightG: z.number().finite().positive().max(100_000).nullable().optional(),
    tags: z.array(z.string().trim().min(1).max(30)).max(20).optional().default([]),
    ingredients: z.array(z.object({
      name: z.string().trim().min(1).max(60),
      aliases: z.array(z.string().trim().min(1).max(60)).max(20).optional().default([]),
      state: z.enum(["raw", "cooked", "packaged"]),
      amountG: z.number().finite().positive().max(100_000),
      edibleRatio: z.number().finite().positive().max(1).optional().default(1),
      nutrientsPer100g: importedNutrientsSchema.optional().default({}),
    }).strict()).min(1).max(100),
  }).strict(),
}).strict();

function completeNutrients(values: Partial<NutrientVector>): NutrientVector {
  return Object.fromEntries(nutrientKeys.map((key) => [key, values[key] ?? null])) as NutrientVector;
}

export function parseRecipeFile(raw: string): Recipe {
  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    throw new Error("文件不是有效的 JSON");
  }
  const result = recipeFileSchema.safeParse(decoded);
  if (!result.success) {
    const issue = result.error.issues[0];
    const location = issue.path.length ? issue.path.join(".") : "文件";
    throw new Error(`格式不正确：${location} ${issue.message}`);
  }
  const stamp = Date.now();
  const sourceVersion = new Date().toISOString().slice(0, 10);
  const imported = result.data.recipe;
  return {
    id: `recipe-import-${stamp}`,
    name: imported.name,
    description: imported.description,
    favorite: false,
    yieldServings: imported.yieldServings,
    finishedWeightG: imported.finishedWeightG ?? undefined,
    tags: imported.tags,
    updatedAt: "刚刚导入",
    ingredients: imported.ingredients.map((ingredient, index) => ({
      id: `ingredient-import-${stamp}-${index}`,
      amountG: ingredient.amountG,
      edibleRatio: ingredient.edibleRatio,
      food: {
        id: `food-import-${stamp}-${index}`,
        name: ingredient.name,
        aliases: ingredient.aliases,
        state: ingredient.state,
        source: "custom",
        sourceVersion,
        nutrientsPer100g: completeNutrients(ingredient.nutrientsPer100g),
      },
    })),
  };
}

export function createRecipeFile(recipe: Recipe) {
  return JSON.stringify({
    format: "hewei-recipe",
    version: 1,
    recipe: {
      name: recipe.name,
      description: recipe.description,
      yieldServings: recipe.yieldServings,
      finishedWeightG: recipe.finishedWeightG ?? null,
      tags: recipe.tags,
      ingredients: recipe.ingredients.map((ingredient) => ({
        name: ingredient.food.name,
        aliases: ingredient.food.aliases,
        state: ingredient.food.state,
        amountG: ingredient.amountG,
        edibleRatio: ingredient.edibleRatio,
        nutrientsPer100g: ingredient.food.nutrientsPer100g,
      })),
    },
  }, null, 2);
}

export function createRecipeTemplate() {
  return JSON.stringify({
    format: "hewei-recipe",
    version: 1,
    recipe: {
      name: "示例菜名",
      description: "简要做法、口味和注意事项",
      yieldServings: 3,
      finishedWeightG: null,
      tags: ["家常"],
      ingredients: [{
        name: "示例食材",
        aliases: [],
        state: "raw",
        amountG: 100,
        edibleRatio: 1,
        nutrientsPer100g: Object.fromEntries(nutrientKeys.map((key) => [key, null])),
      }],
    },
  }, null, 2);
}

export function createGptRecipePrompt() {
  return `请为“【在这里填写菜名】”生成一份家庭菜谱数据。严格使用下面的禾味菜谱 JSON v1 格式，只输出 JSON，不要使用 Markdown 代码块，也不要添加解释。\n\n要求：\n1. 所有重量使用克（g）；edibleRatio 使用 0 到 1 的小数。\n2. state 只能是 raw、cooked、packaged。\n3. nutrientsPer100g 是每 100g 可食部营养：热量 kcal；蛋白质、脂肪、碳水、膳食纤维用 g；钠、钙、铁、钾、维生素 C 用 mg；维生素 D 用 μg。\n4. 无可靠数据的营养值必须写 null，不要猜测，也不要写成 0。\n5. 油、盐和调料作为独立食材列出。\n6. finishedWeightG 不确定时写 null。\n\n格式模板：\n${createRecipeTemplate()}`;
}
