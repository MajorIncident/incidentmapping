import { defineConfig, type UserConfig } from "vite";
import react from "@vitejs/plugin-react";
import { configDefaults } from "vitest/config";
import type { InlineConfig } from "vitest";
import { execSync } from "node:child_process";

const safeGitCommand = (command: string, fallback: string): string => {
  try {
    return execSync(command, { stdio: "pipe" }).toString().trim();
  } catch (error) {
    console.warn(`Git command failed (${command}):`, error);
    return fallback;
  }
};

const buildInfo = {
  version: process.env.npm_package_version ?? "dev",
  commit: safeGitCommand("git rev-parse --short HEAD", "unknown"),
  commitDate: safeGitCommand(
    "git log -1 --format=%cd --date=iso",
    new Date().toISOString(),
  ),
  builtAt: new Date().toISOString(),
};

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
  define: {
    __BUILD_INFO__: JSON.stringify(buildInfo),
  },
  test: vitestConfig,
} as UserConfig & { test: InlineConfig });
