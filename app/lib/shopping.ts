import type { Meal, ShoppingItem } from "./types";

const unitGroups: Partial<Record<ShoppingItem["unit"], { group: "mass" | "volume"; baseMultiplier: number }>> = {
  g: { group: "mass", baseMultiplier: 1 },
  kg: { group: "mass", baseMultiplier: 1000 },
  ml: { group: "volume", baseMultiplier: 1 },
  L: { group: "volume", baseMultiplier: 1000 },
};

export function convertShoppingAmount(amount: number, from: ShoppingItem["unit"], to: ShoppingItem["unit"]) {
  const fromUnit = unitGroups[from];
  const toUnit = unitGroups[to];
  if (!fromUnit || !toUnit || fromUnit.group !== toUnit.group) return amount;
  return Number(((amount * fromUnit.baseMultiplier) / toUnit.baseMultiplier).toFixed(3));
}

function getDishScale(meal: Meal, dish: Meal["dishes"][number]) {
  const allocated = meal.participantIds.reduce((total, memberId) => total + (dish.allocations[memberId] ?? 0), 0);
  if (dish.allocationMode === "servings") return allocated / dish.recipeSnapshot.yieldServings;
  if (!dish.recipeSnapshot.finishedWeightG) return 0;
  return allocated / dish.recipeSnapshot.finishedWeightG;
}

export function generateShoppingFromMeals(meals: Meal[], startDate: string, endDate: string, currentItems: ShoppingItem[]) {
  if (endDate < startDate) throw new Error("结束日期不能早于开始日期");
  const totals = new Map<string, { name: string; amountG: number }>();
  const selectedMeals = meals.filter((meal) => meal.date >= startDate && meal.date <= endDate);

  for (const meal of selectedMeals) {
    for (const dish of meal.dishes) {
      const scale = getDishScale(meal, dish);
      if (!Number.isFinite(scale) || scale <= 0) continue;
      for (const ingredient of dish.recipeSnapshot.ingredients) {
        const name = ingredient.food.name.trim();
        if (!name) continue;
        const key = name.toLocaleLowerCase("zh-CN");
        const current = totals.get(key) ?? { name, amountG: 0 };
        current.amountG += ingredient.amountG * scale;
        totals.set(key, current);
      }
    }
  }

  const previousGenerated = new Map(currentItems.filter((item) => item.source === "generated").map((item) => [item.name.toLocaleLowerCase("zh-CN"), item]));
  const generated: ShoppingItem[] = Array.from(totals.entries()).map(([key, item]) => {
    const previous = previousGenerated.get(key);
    return {
      id: previous?.id ?? `generated-${encodeURIComponent(key)}`,
      name: item.name,
      amount: Number(item.amountG.toFixed(1)),
      unit: "g",
      checked: previous?.checked ?? false,
      source: "generated",
    };
  });
  return {
    items: [...generated, ...currentItems.filter((item) => item.source === "manual")],
    mealCount: selectedMeals.length,
    generatedCount: generated.length,
  };
}
