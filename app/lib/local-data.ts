import { z } from "zod";
import type { Meal, Member, Recipe, ShoppingItem, VitalRecord } from "./types";

export const LOCAL_DATA_KEY = "hewei-local-data-v1";

export type LocalDataBundle = {
  members: Member[];
  recipes: Recipe[];
  meals: Meal[];
  shopping: ShoppingItem[];
  vitals: VitalRecord[];
};

const nutrientValue = z.number().finite().nullable();
const nutrientSchema = z.object({
  energyKcal: nutrientValue,
  proteinG: nutrientValue,
  fatG: nutrientValue,
  carbohydrateG: nutrientValue,
  fiberG: nutrientValue,
  sodiumMg: nutrientValue,
  calciumMg: nutrientValue,
  ironMg: nutrientValue,
  potassiumMg: nutrientValue,
  vitaminCMg: nutrientValue,
  vitaminDUg: nutrientValue,
});
const foodSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  aliases: z.array(z.string()),
  state: z.enum(["raw", "cooked", "packaged"]),
  nutrientsPer100g: nutrientSchema,
  source: z.enum(["USDA-FDC", "package-label", "custom"]),
  sourceId: z.string().optional(),
  sourceVersion: z.string(),
});
const ingredientSchema = z.object({
  id: z.string().min(1),
  food: foodSchema,
  amountG: z.number().nonnegative(),
  edibleRatio: z.number().min(0).max(1),
  displayUnit: z.string().optional(),
});
const recipeDataSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  category: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  favorite: z.boolean(),
  image: z.string().optional(),
  yieldServings: z.number().positive(),
  finishedWeightG: z.number().nonnegative().optional(),
  ingredients: z.array(ingredientSchema),
  tags: z.array(z.string()),
  updatedAt: z.string(),
});
const memberDataSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  relation: z.string(),
  avatar: z.string(),
  managed: z.boolean(),
  healthShared: z.boolean(),
  birthday: z.string(),
  driSex: z.enum(["female", "male"]),
  heightCm: z.number().nonnegative(),
  weightKg: z.number().nonnegative(),
  activity: z.enum(["low", "medium", "high"]),
  goal: z.enum(["maintain", "lose", "gain"]),
  allergies: z.array(z.string()),
});
const mealDataSchema = z.object({
  id: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slot: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  status: z.enum(["planned", "confirmed"]),
  time: z.string(),
  participantIds: z.array(z.string()),
  dishes: z.array(z.object({
    id: z.string().min(1),
    recipeId: z.string().min(1),
    recipeSnapshot: recipeDataSchema,
    allocations: z.record(z.string(), z.number().nonnegative()),
    allocationMode: z.enum(["servings", "grams"]),
  })),
});
const shoppingDataSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  amount: z.number().nonnegative(),
  unit: z.enum(["g", "kg", "ml", "L", "个", "包", "盒"]),
  checked: z.boolean(),
  source: z.enum(["generated", "manual"]),
});
const vitalDataSchema = z.object({
  id: z.string().min(1),
  memberId: z.string().min(1),
  type: z.enum(["weight", "bodyFat", "bloodPressure", "bloodGlucose"]),
  value: z.number().positive(),
  secondaryValue: z.number().positive().optional(),
  unit: z.string(),
  measuredAt: z.string(),
  note: z.string().optional(),
});
const localDataSchema = z.object({
  members: z.array(memberDataSchema).min(1),
  recipes: z.array(recipeDataSchema),
  meals: z.array(mealDataSchema),
  shopping: z.array(shoppingDataSchema),
  vitals: z.array(vitalDataSchema),
});

const backupSchema = z.object({
  app: z.literal("hewei-family-nutrition"),
  version: z.literal(1),
  exportedAt: z.string(),
  data: localDataSchema,
});

export function parseLocalData(raw: string): LocalDataBundle {
  return localDataSchema.parse(JSON.parse(raw));
}

export function createLocalBackup(data: LocalDataBundle) {
  return JSON.stringify({
    app: "hewei-family-nutrition",
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
  }, null, 2);
}

export function parseLocalBackup(raw: string): LocalDataBundle {
  return backupSchema.parse(JSON.parse(raw)).data;
}
