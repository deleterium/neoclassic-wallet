module.exports = {
    env: {
        browser: true,
        es2021: true,
        jquery: true
    },
    extends: [
        'plugin:@typescript-eslint/recommended',
    ],
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module'
    },
    rules: {
        indent: ['error', 4],
        camelcase: 'off',
        eqeqeq: 'warn',
        'handle-callback-err': 'warn',
        'n/no-callback-literal': 'off',
        'no-throw-literal': 'off',
        '@typescript-eslint/no-unused-vars': 'warn',
        '@typescript-eslint/no-explicit-any': 'off', // Currently needed (migration)
        'brace-style': ['warn', '1tbs', { allowSingleLine: false }]
    }
}