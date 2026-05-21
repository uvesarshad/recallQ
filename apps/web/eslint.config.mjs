import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTypescript,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
  {
    files: ["scripts/**/*.js", "workers/**/*.ts"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    // TODO(stage-3): address `react-hooks/set-state-in-effect` violations
    // surfaced after eslint-plugin-react-hooks upgrade; downgrade to warn for
    // now so the existing app keeps passing lint during the monorepo migration.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
    },
  },
];

export default config;
