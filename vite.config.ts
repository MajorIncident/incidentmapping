import { defineConfig, type UserConfig } from "vite";
import react from "@vitejs/plugin-react";
import { configDefaults } from "vitest/config";
import type { InlineConfig } from "vitest";

const vitestConfig: InlineConfig = {
  globals: true,
  environment: "jsdom",
  setupFiles: ["./tests/setup.ts"],
  coverage: {
    provider: "v8",
  },
  exclude: [...configDefaults.exclude, "tests/e2e/**"],
};

export default defineConfig({
  plugins: [react()],
  test: vitestConfig,
} as UserConfig & { test: InlineConfig });
