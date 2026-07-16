export const nutrientKeys = [
  "energyKcal",
  "proteinG",
  "fatG",
  "carbohydrateG",
  "fiberG",
  "sodiumMg",
  "calciumMg",
  "ironMg",
  "potassiumMg",
  "vitaminCMg",
  "vitaminDUg",
] as const;

export type NutrientKey = (typeof nutrientKeys)[number];

export type NutrientVector = Record<NutrientKey, number | null>;

export type FoodState = "raw" | "cooked" | "packaged";
export type MealStatus = "planned" | "confirmed";
export type AllocationMode = "servings" | "grams";
export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";

export type FoodItem = {
  id: string;
  name: string;
  aliases: string[];
  state: FoodState;
  nutrientsPer100g: NutrientVector;
  source: "USDA-FDC" | "package-label" | "custom";
  sourceId?: string;
  sourceVersion: string;
};

export type Ingredient = {
  id: string;
  food: FoodItem;
  amountG: number;
  edibleRatio: number;
  displayUnit?: string;
};

export type Recipe = {
  id: string;
  name: string;
  description: string;
  /** @deprecated 餐别由菜单中的 Meal.slot 决定；仅保留用于兼容旧的本机备份。 */
  category?: MealSlot;
  favorite: boolean;
  image?: string;
  yieldServings: number;
  finishedWeightG?: number;
  ingredients: Ingredient[];
  tags: string[];
  updatedAt: string;
};

export type Member = {
  id: string;
  name: string;
  relation: string;
  avatar: string;
  managed: boolean;
  healthShared: boolean;
  birthday: string;
  driSex: "female" | "male";
  heightCm: number;
  weightKg: number;
  activity: "low" | "medium" | "high";
  goal: "maintain" | "lose" | "gain";
  allergies: string[];
};

export type MealDish = {
  id: string;
  recipeId: string;
  recipeSnapshot: Recipe;
  allocations: Record<string, number>;
  allocationMode: AllocationMode;
};

export type Meal = {
  id: string;
  date: string;
  slot: MealSlot;
  status: MealStatus;
  time: string;
  participantIds: string[];
  dishes: MealDish[];
};

export type ShoppingItem = {
  id: string;
  name: string;
  amount: number;
  unit: "g" | "kg" | "ml" | "L" | "个" | "包" | "盒";
  checked: boolean;
  source: "generated" | "manual";
};

export type VitalRecord = {
  id: string;
  memberId: string;
  type: "weight" | "bodyFat" | "bloodPressure" | "bloodGlucose";
  value: number;
  secondaryValue?: number;
  unit: string;
  measuredAt: string;
  note?: string;
};

export type NutritionTarget = {
  key: NutrientKey;
  target: number;
  upper?: number;
};

export type NutritionStatus = {
  key: NutrientKey;
  value: number | null;
  target: number;
  upper?: number;
  complete: boolean;
  label: "数据不完整" | "未达到参考值" | "达到参考值" | "参考范围内" | "超过参考上限";
  percent: number;
};
