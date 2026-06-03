import tsparser from "@typescript-eslint/parser";
import tseslint from "@typescript-eslint/eslint-plugin";

/**
 * Flat ESLint config (ESLint 9). Intentionally lightweight: the codebase relies
 * on `tsc --noEmit` (via `pnpm typecheck`) for correctness, while ESLint focuses
 * on catching obvious mistakes such as unused symbols.
 */
export default [
  {
    ignores: [
      "**/dist/**",
      "**/.next/**",
      "**/.turbo/**",
      "**/node_modules/**",
      "**/coverage/**",
      "**/*.d.ts",
      "**/.fakebase/**",
    ],
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsparser,
      ecmaVersion: 2022,
      sourceType: "module",
    },
    plugins: {
      "@typescript-eslint": tseslint,
    },
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      "no-console": "off",
      "prefer-const": "warn",
      eqeqeq: ["warn", "smart"],
    },
  },
];
