import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],
    build: {
      outDir: "cloudbase-dist",
      emptyOutDir: true,
      sourcemap: false,
    },
    define: {
      "process.env.NODE_ENV": JSON.stringify(mode === "production" ? "production" : "development"),
      "process.env.NEXT_PUBLIC_CLOUDBASE_ENV_ID": JSON.stringify(env.NEXT_PUBLIC_CLOUDBASE_ENV_ID ?? ""),
      "process.env.NEXT_PUBLIC_CLOUDBASE_PUBLISHABLE_KEY": JSON.stringify(env.NEXT_PUBLIC_CLOUDBASE_PUBLISHABLE_KEY ?? ""),
    },
  };
});
