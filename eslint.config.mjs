import { defineConfig, globalIgnores } from "eslint/config";
import coreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  globalIgnores([".next/**", "node_modules/**", "out/**", "drizzle/**", "coverage/**", "next-env.d.ts"]),
  ...coreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // Publisher/news images come from arbitrary hosts; plain <img> with
      // lazy loading is a deliberate choice (see next.config.ts).
      "@next/next/no-img-element": "off",
      // Async fetch-then-setState inside effects is the intended data-flow
      // here; state updates happen after awaits, not synchronously.
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);
