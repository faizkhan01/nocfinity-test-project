import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    // Pure logic, the middleware and the BFF run in Node; component tests opt into jsdom per file.
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./vitest.setup.ts"],
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    coverage: {
      provider: "v8",
      // Unit coverage is held for the logic layer; pages and data hooks are covered end to end by Playwright.
      include: ["src/lib/**", "src/hooks/**", "src/middleware.ts", "src/app/bff/**"],
      exclude: ["src/lib/types.ts", "src/lib/countries.ts", "src/lib/api/server.ts", "src/hooks/use-api-form.ts", "src/hooks/use-cart.ts", "src/hooks/use-customer.ts"],
      reporter: ["text-summary", "html"],
      thresholds: { lines: 90, branches: 85, functions: 85, statements: 90 },
    },
  },
});
