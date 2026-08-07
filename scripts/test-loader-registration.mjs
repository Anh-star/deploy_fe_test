/**
 * Test-runner bootstrap. Registers the custom ESM resolver so the test
 * suite can import production source files that use extension-less
 * imports (Vite-style) without modifying any production code.
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";

const loaderPath = fileURLToPath(new URL("./test-loader.mjs", import.meta.url));
register(pathToFileURL(loaderPath).href);