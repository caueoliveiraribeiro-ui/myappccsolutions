import { FlatCompat } from "@eslint/eslintrc"
import { fileURLToPath } from "node:url"
import path from "node:path"

const baseDirectory = path.dirname(fileURLToPath(import.meta.url))
const compat = new FlatCompat({ baseDirectory })

const config = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [".next/**", "node_modules/**", "coverage/**", "scripts/**", "next-env.d.ts"],
    rules: {
      // The app predates strict linting. Keep TypeScript's existing typecheck as
      // the migration guard while this baseline enforces runtime, hook, route,
      // navigation and accessibility safety.
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "react-hooks/exhaustive-deps": "off",
      "@next/next/no-img-element": "off",
    },
  },
]

export default config
