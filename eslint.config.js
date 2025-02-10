import { configs } from "@annangela/eslint-config";
/**
 * @type { import("eslint").Linter.Config["ignores"] }
 */
const ignores = [
    "**/dist/**",
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
];
export default config;
