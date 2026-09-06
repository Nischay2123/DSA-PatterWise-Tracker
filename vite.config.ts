import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    // jsdom, not node: the persistence layer (localStorage), the backup
    // download and the three React hooks are all real logic that simply
    // cannot execute without a DOM. Under `node` they weren't failing, they
    // were unreachable -- which is worse, because it looks like passing.
    environment: "jsdom",
    setupFiles: ["src/test-setup.ts"],
    // Stryker copies the whole project into .stryker-tmp sandboxes while it
    // runs; without this, a concurrent `vitest run` discovers those copies
    // and reports roughly double the real test count.
    exclude: ["node_modules/**", "dist/**", ".stryker-tmp/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: "coverage",
      // What the test strategy actually covers. Plan decision #12 is
      // "Vitest on pure logic only. No component/E2E tests", so measuring
      // .tsx here would report the deliberate absence of component tests as
      // a coverage hole and drown the signal from the logic that IS tested.
      // Components are verified by the per-phase live browser passes instead.
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/main.tsx", "src/vite-env.d.ts", "src/types.ts"],
      thresholds: {
        statements: 95,
        branches: 95,
        functions: 95,
        lines: 95,
      },
    },
  },
});
