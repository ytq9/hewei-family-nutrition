import type { FoodItem, Meal, Member, NutrientVector, Recipe, ShoppingItem, VitalRecord } from "./types";

const nutrient = (values: Partial<NutrientVector>): NutrientVector => ({
  energyKcal: null,
  proteinG: null,
  fatG: null,
  carbohydrateG: null,
  fiberG: null,
  sodiumMg: null,
  calciumMg: null,
  ironMg: null,
  potassiumMg: null,
  vitaminCMg: null,
  vitaminDUg: null,
  ...values,
});

const foods: Record<string, FoodItem> = {
  rice: { id: "rice", name: "熟米饭", aliases: ["米饭"], state: "cooked", source: "USDA-FDC", sourceId: "169756", sourceVersion: "2025-04", nutrientsPer100g: nutrient({ energyKcal: 130, proteinG: 2.7, fatG: 0.3, carbohydrateG: 28.2, fiberG: 0.4, sodiumMg: 1, calciumMg: 10, ironMg: 0.2, potassiumMg: 35, vitaminCMg: 0, vitaminDUg: 0 }) },
  salmon: { id: "salmon", name: "三文鱼", aliases: ["鲑鱼"], state: "raw", source: "USDA-FDC", sourceId: "175167", sourceVersion: "2025-04", nutrientsPer100g: nutrient({ energyKcal: 208, proteinG: 20.4, fatG: 13.4, carbohydrateG: 0, fiberG: 0, sodiumMg: 59, calciumMg: 9, ironMg: 0.3, potassiumMg: 363, vitaminCMg: 0, vitaminDUg: 13.1 }) },
  broccoli: { id: "broccoli", name: "西兰花", aliases: ["青花菜"], state: "raw", source: "USDA-FDC", sourceId: "170379", sourceVersion: "2025-04", nutrientsPer100g: nutrient({ energyKcal: 34, proteinG: 2.8, fatG: 0.4, carbohydrateG: 6.6, fiberG: 2.6, sodiumMg: 33, calciumMg: 47, ironMg: 0.7, potassiumMg: 316, vitaminCMg: 89.2, vitaminDUg: 0 }) },
  oliveOil: { id: "olive-oil", name: "橄榄油", aliases: ["食用油"], state: "packaged", source: "USDA-FDC", sourceId: "171413", sourceVersion: "2025-04", nutrientsPer100g: nutrient({ energyKcal: 884, proteinG: 0, fatG: 100, carbohydrateG: 0, fiberG: 0, sodiumMg: 2, calciumMg: 1, ironMg: 0.6, potassiumMg: 1, vitaminCMg: 0, vitaminDUg: 0 }) },
  egg: { id: "egg", name: "鸡蛋", aliases: ["蛋"], state: "raw", source: "USDA-FDC", sourceId: "171287", sourceVersion: "2025-04", nutrientsPer100g: nutrient({ energyKcal: 143, proteinG: 12.6, fatG: 9.5, carbohydrateG: 0.7, fiberG: 0, sodiumMg: 142, calciumMg: 56, ironMg: 1.8, potassiumMg: 138, vitaminCMg: 0, vitaminDUg: 2 }) },
  tomato: { id: "tomato", name: "番茄", aliases: ["西红柿"], state: "raw", source: "USDA-FDC", sourceId: "170457", sourceVersion: "2025-04", nutrientsPer100g: nutrient({ energyKcal: 18, proteinG: 0.9, fatG: 0.2, carbohydrateG: 3.9, fiberG: 1.2, sodiumMg: 5, calciumMg: 10, ironMg: 0.3, potassiumMg: 237, vitaminCMg: 13.7, vitaminDUg: 0 }) },
  tofu: { id: "tofu", name: "北豆腐", aliases: ["豆腐"], state: "raw", source: "USDA-FDC", sourceId: "172475", sourceVersion: "2025-04", nutrientsPer100g: nutrient({ energyKcal: 144, proteinG: 17.3, fatG: 8.7, carbohydrateG: 2.8, fiberG: 2.3, sodiumMg: 14, calciumMg: 683, ironMg: 2.7, potassiumMg: 237, vitaminCMg: 0.2, vitaminDUg: 0 }) },
  spinach: { id: "spinach", name: "菠菜", aliases: [], state: "raw", source: "USDA-FDC", sourceId: "168462", sourceVersion: "2025-04", nutrientsPer100g: nutrient({ energyKcal: 23, proteinG: 2.9, fatG: 0.4, carbohydrateG: 3.6, fiberG: 2.2, sodiumMg: 79, calciumMg: 99, ironMg: 2.7, potassiumMg: 558, vitaminCMg: 28.1, vitaminDUg: 0 }) },
};

export const initialRecipes: Recipe[] = [
  {
    id: "salmon-bowl", name: "香煎三文鱼蔬菜碗", description: "优质蛋白配彩色蔬菜，清爽的一餐。", category: "lunch", favorite: true, yieldServings: 3, finishedWeightG: 880, tags: ["高蛋白", "少油"], updatedAt: "今天 09:20",
    ingredients: [
      { id: "i1", food: foods.salmon, amountG: 360, edibleRatio: 1 },
      { id: "i2", food: foods.broccoli, amountG: 240, edibleRatio: 0.95 },
      { id: "i3", food: foods.rice, amountG: 360, edibleRatio: 1 },
      { id: "i4", food: foods.oliveOil, amountG: 15, edibleRatio: 1 },
    ],
  },
  {
    id: "tomato-egg", name: "番茄炒蛋", description: "全家都喜欢的快手家常菜。", category: "dinner", favorite: true, yieldServings: 3, finishedWeightG: 560, tags: ["家常", "快手"], updatedAt: "昨天 18:40",
    ingredients: [
      { id: "i5", food: foods.tomato, amountG: 360, edibleRatio: 0.98 },
      { id: "i6", food: foods.egg, amountG: 220, edibleRatio: 0.88 },
      { id: "i7", food: foods.oliveOil, amountG: 18, edibleRatio: 1 },
    ],
  },
  {
    id: "tofu-spinach", name: "菠菜豆腐汤", description: "温和清淡，补充钙和膳食纤维。", category: "dinner", favorite: false, yieldServings: 4, finishedWeightG: 1100, tags: ["清淡", "高钙"], updatedAt: "7月14日",
    ingredients: [
      { id: "i8", food: foods.tofu, amountG: 320, edibleRatio: 1 },
      { id: "i9", food: foods.spinach, amountG: 260, edibleRatio: 0.92 },
    ],
  },
];

export const initialMembers: Member[] = [
  { id: "m1", name: "安然", relation: "我", avatar: "安", managed: false, healthShared: true, birthday: "1991-04-16", driSex: "female", heightCm: 165, weightKg: 57.6, activity: "medium", goal: "maintain", allergies: [] },
  { id: "m2", name: "承宇", relation: "伴侣", avatar: "承", managed: false, healthShared: true, birthday: "1989-09-03", driSex: "male", heightCm: 178, weightKg: 73.2, activity: "medium", goal: "maintain", allergies: ["花生"] },
  { id: "m3", name: "小满", relation: "女儿 · 8岁", avatar: "满", managed: true, healthShared: true, birthday: "2018-05-21", driSex: "female", heightCm: 128, weightKg: 25.4, activity: "high", goal: "maintain", allergies: ["虾"] },
];

const today = new Date().toISOString().slice(0, 10);
export const initialMeals: Meal[] = [
  { id: "meal-breakfast", date: today, slot: "breakfast", status: "confirmed", time: "07:30", participantIds: ["m1", "m2", "m3"], dishes: [{ id: "dish-breakfast", recipeId: "tomato-egg", recipeSnapshot: initialRecipes[1], allocationMode: "servings", allocations: { m1: 0.8, m2: 1.2, m3: 0.7 } }] },
  { id: "meal-lunch", date: today, slot: "lunch", status: "planned", time: "12:10", participantIds: ["m1", "m2", "m3"], dishes: [{ id: "dish-lunch", recipeId: "salmon-bowl", recipeSnapshot: initialRecipes[0], allocationMode: "servings", allocations: { m1: 1, m2: 1, m3: 1 } }] },
  { id: "meal-dinner", date: today, slot: "dinner", status: "planned", time: "18:40", participantIds: ["m1", "m2", "m3"], dishes: [{ id: "dish-dinner", recipeId: "tofu-spinach", recipeSnapshot: initialRecipes[2], allocationMode: "servings", allocations: { m1: 1, m2: 1.5, m3: 0.8 } }] },
];

export const initialShopping: ShoppingItem[] = [
  { id: "s1", name: "三文鱼", amount: 360, unit: "g", checked: false, source: "generated" },
  { id: "s2", name: "西兰花", amount: 500, unit: "g", checked: true, source: "generated" },
  { id: "s3", name: "番茄", amount: 6, unit: "个", checked: false, source: "generated" },
  { id: "s4", name: "北豆腐", amount: 2, unit: "盒", checked: false, source: "generated" },
  { id: "s5", name: "低脂牛奶", amount: 2, unit: "L", checked: false, source: "manual" },
];

export const initialVitals: VitalRecord[] = [
  { id: "v1", memberId: "m1", type: "weight", value: 58.4, unit: "kg", measuredAt: "2026-06-18" },
  { id: "v2", memberId: "m1", type: "weight", value: 58.0, unit: "kg", measuredAt: "2026-06-28" },
  { id: "v3", memberId: "m1", type: "weight", value: 57.8, unit: "kg", measuredAt: "2026-07-08" },
  { id: "v4", memberId: "m1", type: "weight", value: 57.6, unit: "kg", measuredAt: "2026-07-16" },
  { id: "v5", memberId: "m1", type: "bloodPressure", value: 112, secondaryValue: 72, unit: "mmHg", measuredAt: "2026-07-16" },
];

export const driTargets = {
  energyKcal: 1850,
  proteinG: 55,
  fatG: 60,
  carbohydrateG: 260,
  fiberG: 25,
  sodiumMg: 1500,
  calciumMg: 800,
  ironMg: 20,
  potassiumMg: 2000,
  vitaminCMg: 100,
  vitaminDUg: 10,
} satisfies Record<keyof NutrientVector, number>;

export const weekDays = [
  { day: "一", date: "13" }, { day: "二", date: "14" }, { day: "三", date: "15" },
  { day: "四", date: "16", current: true }, { day: "五", date: "17" }, { day: "六", date: "18" }, { day: "日", date: "19" },
];
