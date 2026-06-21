// eslint.config.mts
import globals from "globals";
import tseslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";
import prettierPlugin from "eslint-plugin-prettier";
import { defineConfig } from "eslint/config";

export default defineConfig([
    {
        files: ["**/*.{ts,tsx}"],
        plugins: { prettier: prettierPlugin },
        extends: [
            tseslint.configs.recommended,
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
            "@typescript-eslint/no-unused-vars": "warn",
            "@typescript-eslint/no-explicit-any": "off",
            "brace-style": ["warn", "1tbs", { allowSingleLine: false }],
            "prettier/prettier": [
                "error",
                {
                    bracketSameLine: true,
                    printWidth: 140,
                    semi: false,
                    singleQuote: true,
                    tabWidth: 4,
                    useTabs: false
                }
            ]
        }
    }
]);
