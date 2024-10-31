import { configs } from "@annangela/eslint-config";
/**
 * @type { import("eslint").Linter.Config["ignores"] }
 */
const ignores = [
    "**/dist/**",
    "**/.*/**",
    "node_modules",
];
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
        rules: {
            "security/detect-non-literal-fs-filename": "off",
            "security/detect-object-injection": "off",
            "security/detect-child-process": "off",
            "n/no-unsupported-features/node-builtins": ["error", {
                version: "^20.11 || ^22.11",
                ignores: [
                    "fs.promises.cp",
                ],
            }],
        },
    },
];
export default config;
