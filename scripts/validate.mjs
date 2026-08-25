import { loadRegistry } from "./lib.mjs";

try {
  const registry = await loadRegistry();
  console.log(`Registry valid: ${registry.publishers.length} keys, ${registry.extensions.length} extensions, ${registry.advisories.length} advisories`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
