import path from "node:path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    css: false,
    exclude: ["**/node_modules/**", "**/.next/**", "**/out/**", "**/src-tauri/**", "**/e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov", "json"],
      reportsDirectory: "coverage",
      include: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}"],
      exclude: ["**/*.d.ts", "**/*.test.{ts,tsx}", "app/**/layout.tsx", "app/**/page.tsx"],
      thresholds: {
        lines: 70,
        functions: 60,
        branches: 60,
        statements: 70,
      },
    },
  },
})
