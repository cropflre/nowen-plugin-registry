import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadRegistry, REPOSITORY_ROOT, unsignedIndex } from "./lib.mjs";

try {
  const registry = await loadRegistry();
  const output = path.join(REPOSITORY_ROOT, "dist/v2");
  await rm(path.join(REPOSITORY_ROOT, "dist"), { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  await writeFile(path.join(output, "index.unsigned.json"), `${JSON.stringify(unsignedIndex(registry), null, 2)}\n`);
  console.log(`Built unsigned Registry in ${path.relative(REPOSITORY_ROOT, output)}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
