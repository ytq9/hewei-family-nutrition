import type { Meal, MealDish } from "./types";

function appendUniqueDishes(current: MealDish[], incoming: MealDish[], mealId: string) {
  const usedIds = new Set(current.map((dish) => dish.id));
  return incoming.map((dish, index) => {
    if (!usedIds.has(dish.id)) {
      usedIds.add(dish.id);
      return dish;
    }
    let id = `${dish.id}-${mealId}`;
    let suffix = index;
    while (usedIds.has(id)) id = `${dish.id}-${mealId}-${suffix++}`;
    usedIds.add(id);
    return { ...dish, id };
  });
}

/** 同一天同一餐别只保留一个 Meal，菜品合并到 dishes 中。 */
export function mergeMealsByDateAndSlot(meals: Meal[]) {
  const grouped = new Map<string, Meal>();

  for (const meal of meals) {
    const key = `${meal.date}|${meal.slot}`;
    const current = grouped.get(key);
    if (!current) {
      grouped.set(key, { ...meal, participantIds: [...meal.participantIds], dishes: [...meal.dishes] });
      continue;
    }
    grouped.set(key, {
      ...current,
      status: current.status === "confirmed" && meal.status === "confirmed" ? "confirmed" : "planned",
      participantIds: Array.from(new Set([...current.participantIds, ...meal.participantIds])),
      dishes: [...current.dishes, ...appendUniqueDishes(current.dishes, meal.dishes, meal.id)],
    });
  }

  return Array.from(grouped.values());
}

export function addOrMergeMeal(meals: Meal[], incoming: Meal) {
  return mergeMealsByDateAndSlot([...meals, incoming]);
}
