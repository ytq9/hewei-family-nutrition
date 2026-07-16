import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import NutritionApp from "./NutritionApp";
import { Providers } from "./providers";
import "./globals.css";

const root = document.getElementById("root");

if (!root) throw new Error("找不到应用挂载节点");

createRoot(root).render(
  <StrictMode>
    <Providers>
      <NutritionApp />
    </Providers>
  </StrictMode>,
);
