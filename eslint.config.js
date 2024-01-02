import { baseConfig, typescriptConfig } from "@annangela/eslint-config";
/**
 * @type { import("eslint").Linter.FlatConfig[] }
 */
const config = [
    { // Default config
        ...baseConfig,
    },
    { // For TypeScript files in src/
        files: [
            "src/**/*.ts",
        ],
        ...typescriptConfig,
    },
];
export default config;
