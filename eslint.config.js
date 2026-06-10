import { configs } from "@annangela/eslint-config";
/**
 * @type { import("eslint").Linter.Config["ignores"] }
 */
const ignores = [
    "**/dist/**",
    "**/coverage/**",
    "**/.*/**",
    "node_modules",
];
const nodeConfig = configs.node;
nodeConfig.rules["n/no-unsupported-features/node-builtins"] = ["error", {
    version: "^22.11",
    ignores: [
        "fs.promises.cp",
    ],
}];
/**
 * @type { import("eslint").Linter.Config[] }
 */
const config = [
    // Global ignores — matches ESLint flat config semantics
    {
        ignores: [
            "coverage/",
            "**/coverage/",
        ],
    },
    // base
    {
        ...configs.base,
        files: [
            "**/*.js",
            "**/*.ts",
        ],
        ignores,
    },
    {
        ...configs.node,
        files: [
            "**/*.js",
            "**/*.ts",
        ],
        ignores,
    },
    // For TypeScript files
    {
        ...configs.typescript,
        files: [
            "**/*.ts",
        ],
        ignores,
    },
    // Run in trusted environments
    {
        files: [
            "**/*.js",
            "**/*.ts",
        ],
        rules: {
            "security/detect-non-literal-fs-filename": "off",
            "security/detect-object-injection": "off",
            "security/detect-child-process": "off",
        },
    },
    // github api use underscores naming
    {
        files: [
            "**/*.ts",
        ],
        rules: {
            camelcase: [
                "error",
                {
                    allow: [
                        "per_page",
                    ],
                },
            ],
        },
    },
    // Test files: relax rules that conflict with vitest patterns
    {
        files: [
            "**/__tests__/**",
        ],
        rules: {
            // vitest mockImplementation and execFile inherently use callbacks
            "promise/prefer-await-to-callbacks": "off",
            // async in beforeEach/describe is standard vitest pattern,
            // but only disable checksVoidReturn.arguments to still catch
            // real Promise misuse like conditionals on Promises
            "@typescript-eslint/no-misused-promises": [
                "error",
                {
                    checksVoidReturn: {
                        arguments: false,
                    },
                },
            ],
        },
    },
];
export default config;
