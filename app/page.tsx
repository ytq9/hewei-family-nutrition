import type { Metadata } from "next";
import NutritionApp from "./NutritionApp";

export const metadata: Metadata = {
  description: "安排全家一日三餐，记录食材与份量，查看每位家庭成员的营养参考进度。",
};

export default function Home() {
  return <NutritionApp />;
}
