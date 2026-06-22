import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: process.env.GITHUB_PAGES === "true" ? "/Subdivision-Quiz/" : "/",
  plugins: [react()],
  server: {
    watch: {
      ignored: ["**/data/raw/**"],
    },
  },
  test: {
    setupFiles: "./tests/setup/vitest.setup.ts",
  },
});
