import stylistic from "@stylistic/eslint-plugin";
import stylisticMigratePlugin from "@stylistic/eslint-plugin-migrate";
import preferReflectPlugin from "@annangela/eslint-plugin-prefer-reflect";
import preferArrowFunctionsPlugin from "eslint-plugin-prefer-arrow-functions";
import nodePlugin from "eslint-plugin-node";
import typescriptPlugin from "@typescript-eslint/eslint-plugin";
import typescriptParser from "@typescript-eslint/parser";
import eslintJS from "@eslint/js";
const { plugins: stylisticPlugin, rules: stylisticPluginRules } = stylistic.configs.customize({
    flat: true,
    indent: 4,
    quotes: "double",
    semi: true,
    jsx: false,
});
/**
 * @type { import("eslint").Linter.FlatConfig[] }
 */
const config = [
    { // Default config
        ignores: [
            "dist/**/*",
            ".cache/**/*",
        ],
        linterOptions: {
            reportUnusedDisableDirectives: "error",
        },
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            parserOptions: {
                ecmaVersion: "latest",
                sourceType: "module",
            },
            globals: {
                ...nodePlugin.configs.recommended.globals,
            },
        },
        plugins: {
            ...stylisticPlugin,
            node: nodePlugin,
            "@stylistic/migrate": stylisticMigratePlugin,
            "@annangela/prefer-reflect": preferReflectPlugin,
            "prefer-arrow-functions": preferArrowFunctionsPlugin,
        },
        rules: {
            ...eslintJS.configs.recommended.rules,
            ...nodePlugin.configs.recommended.rules,
            "node/no-unsupported-features/es-syntax": "off",
            "node/no-missing-import": [
                "error",
                {
                    allowModules: [
                        "@typescript-eslint/eslint-plugin",
                        "@typescript-eslint/parser",
                    ],
                },
            ],
            ...stylisticPluginRules,
            "@stylistic/migrate/migrate": "error",
            "@stylistic/brace-style": "error",
            "@annangela/prefer-reflect/prefer-reflect": "error",
            "prefer-arrow-functions/prefer-arrow-functions": [
                "error",
                {
                    classPropertiesAllowed: true,
                    disallowPrototype: true,
                    returnStyle: "implicit",
                    singleReturnOnly: false,
                },
            ],
            "logical-assignment-operators": "error",
            "no-new-func": "error",
            "no-object-constructor": "error",
            "no-new-wrappers": "error",
            "no-var": "error",
            "prefer-const": "error",
            "@stylistic/no-extra-parens": "error",
            "no-misleading-character-class": "error",
            "no-template-curly-in-string": "error",
            "require-atomic-updates": "error",
            curly: "error",
            "@stylistic/indent": [
                2,
                4,
                {
                    SwitchCase: 1,
                },
            ],
            "@stylistic/linebreak-style": "error",
            "no-console": [
                0,
            ],
            "no-unused-vars": [
                1,
                {
                    varsIgnorePattern: "^_",
                },
            ],
            "no-redeclare": [
                1,
            ],
            "no-unreachable": [
                1,
            ],
            "no-inner-declarations": [
                0,
            ],
            "@stylistic/comma-dangle": [
                1,
                "always-multiline",
            ],
            eqeqeq: "error",
            "dot-notation": "error",
            "no-else-return": "error",
            "no-extra-bind": "error",
            "no-labels": "error",
            "@stylistic/no-floating-decimal": "error",
            "no-lone-blocks": "error",
            "no-loop-func": "error",
            "no-magic-numbers": "off",
            "@stylistic/no-multi-spaces": "error",
            "no-param-reassign": "error",
            strict: [
                "error",
                "global",
            ],
            "@stylistic/quotes": [
                1,
                "double",
                {
                    avoidEscape: true,
                },
            ],
            "@stylistic/quote-props": [
                1,
                "as-needed",
                {
                    keywords: true,
                    unnecessary: true,
                    numbers: false,
                },
            ],
            "no-empty": [
                "error",
                {
                    allowEmptyCatch: true,
                },
            ],
            "@stylistic/arrow-spacing": [
                "error",
                {
                    before: true,
                    after: true,
                },
            ],
            "prefer-arrow-callback": "error",
            "prefer-spread": "error",
            "prefer-template": "error",
            "prefer-rest-params": "error",
            "prefer-exponentiation-operator": "error",
            "require-await": "error",
            "@stylistic/arrow-parens": "error",
            "no-use-before-define": "error",
            camelcase: "error",
        },
    },
    { // For this file
        files: [
            "eslint.config.js",
        ],
    },
    { // For TypeScript files in src/
        files: [
            "src/**/*.ts",
        ],
        languageOptions: {
            ecmaVersion: 2022, // Node 18 - https://github.com/tsconfig/bases#centralized-recommendations-for-tsconfig-bases
            parser: typescriptParser,
            parserOptions: {
                ecmaVersion: 2022, // Node 18 - https://github.com/tsconfig/bases#centralized-recommendations-for-tsconfig-bases
                project: "tsconfig.json",
                lib: [
                    "es2023", // Node 18 - https://github.com/tsconfig/bases#centralized-recommendations-for-tsconfig-bases
                ],
            },
        },
        plugins: {
            "@typescript-eslint": typescriptPlugin,
        },
        rules: {
            ...typescriptPlugin.configs["eslint-recommended"].rules,
            ...typescriptPlugin.configs["strict-type-checked"].rules,
            ...typescriptPlugin.configs["stylistic-type-checked"].rules,
            "i18n-text/no-en": "off",
            "prettier/prettier": "off",
            "@stylistic/lines-between-class-members": "off",
        },
    },
];
export default config;
