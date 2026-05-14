// eslint.config.mts
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";
import { defineConfig } from "eslint/config";

export default defineConfig([
    {
        files: ["**/*.{js,mjs,cjs}"],
        plugins: { js },
        extends: [
            "js/recommended",
            prettierConfig,
        ],
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.jquery,
            },
            parserOptions: {
                ecmaVersion: "latest",
                sourceType: "module",
            },
        },
        rules: {
            "no-unused-vars": "warn",
            "brace-style": ["warn", "1tbs", { allowSingleLine: false }],
        }
    },
    {
        files: ["**/*.{ts,tsx}"],
        extends: [
            tseslint.configs.recommended,
            prettierConfig,
        ],
        rules: {
            "@typescript-eslint/no-unused-vars": "warn",
            "@typescript-eslint/no-explicit-any": "warn",
            "brace-style": ["warn", "1tbs", { allowSingleLine: false }],
        }
    }
]);
