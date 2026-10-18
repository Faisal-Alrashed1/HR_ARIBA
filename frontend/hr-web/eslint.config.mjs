import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Their HR program, copied verbatim from ARIBA_HR_React/src (linted there by oxlint); only the transport/router files
    // listed in src/port/ADAPTED.md were changed. The files written for the port are linted:
    "src/port/**",
    "!src/port/next/**",
    "!src/port/router.jsx",
    "!src/port/lib/api.js",
    "!src/port/lib/auth.js",
  ]),
]);

export default eslintConfig;
