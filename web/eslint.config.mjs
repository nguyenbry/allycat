import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import tseslint from "typescript-eslint";

// Next.js 16 ships this as a native flat config, so the previous FlatCompat
// wrapper now throws on a circular plugin reference. Its bundled
// "next/typescript" entry also registers @typescript-eslint, which collides
// with the stricter type-checked setup below; drop it and let that block own
// the plugin, which is what the pre-16 config effectively did.
const nextConfigs = nextCoreWebVitals.filter(
  (config) => config.name !== "next/typescript"
);

export default tseslint.config(
  {
    ignores: [".next", "next-env.d.ts"],
  },
  ...nextConfigs,
  {
    files: ["**/*.ts", "**/*.tsx"],
    extends: [
      ...tseslint.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
    ],
    rules: {
      "@typescript-eslint/array-type": "off",
      "@typescript-eslint/consistent-type-definitions": "off",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { attributes: false } },
      ],
      "@typescript-eslint/no-unnecessary-condition": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "consistent-return": "error",
    },
  },
  {
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
  }
);
