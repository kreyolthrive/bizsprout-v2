module.exports = {
  extends: ["next/core-web-vitals", "plugin:@typescript-eslint/recommended"],
  rules: {
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }]
  },
  overrides: [
    {
      files: ["src/pages/api/**/*.{ts,tsx}"],
      rules: {
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/explicit-module-boundary-types": "off"
      }
    },
    {
      files: ["src/legacy/**/*.{ts,tsx}", "demo/**/*.{ts,tsx}", "examples/**/*.{ts,tsx}"],
      rules: {
        "@typescript-eslint/no-explicit-any": "off",
        "no-console": "off"
      }
    }
  ]
};
