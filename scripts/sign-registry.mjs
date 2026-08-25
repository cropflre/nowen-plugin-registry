import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  assertPrivateKeyMatches,
  loadRegistry,
  privateKeyFromEnvironmentOrFile,
  REPOSITORY_ROOT,
  signDocument,
} from "./lib.mjs";

function option(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

try {
  const registry = await loadRegistry();
  const privateKey = assertPrivateKeyMatches(
    registry.root.publicKey,
    await privateKeyFromEnvironmentOrFile(REPOSITORY_ROOT, option("key")),
  );
  const unsignedPath = path.join(REPOSITORY_ROOT, "dist/v2/index.unsigned.json");
  const unsigned = JSON.parse(await readFile(unsignedPath, "utf8"));
  unsigned.advisories = unsigned.advisories.map((advisory) => signDocument({
    ...advisory,
    signerKeyId: registry.root.keyId,
  }, privateKey));
  const index = signDocument(unsigned, privateKey);
  const advisories = signDocument({
    protocolVersion: 2,
    sequence: index.sequence,
    generatedAt: index.generatedAt,
    expiresAt: index.expiresAt,
    signerKeyId: index.signerKeyId,
    advisories: index.advisories,
  }, privateKey);
  await writeFile(path.join(REPOSITORY_ROOT, "dist/v2/index.json"), `${JSON.stringify(index, null, 2)}\n`);
  await writeFile(path.join(REPOSITORY_ROOT, "dist/v2/index.sig"), `${index.signature}\n`);
  await writeFile(path.join(REPOSITORY_ROOT, "dist/v2/advisories.json"), `${JSON.stringify(advisories, null, 2)}\n`);
  await writeFile(path.join(REPOSITORY_ROOT, "dist/v2/root.json"), `${JSON.stringify(registry.root, null, 2)}\n`);
  await writeFile(path.join(REPOSITORY_ROOT, "dist/.nojekyll"), "");
  await writeFile(path.join(REPOSITORY_ROOT, "dist/index.html"), "<!doctype html><meta charset=\"utf-8\"><title>Nowen Plugin Registry</title><h1>Nowen Plugin Registry V2</h1><p><a href=\"./v2/index.json\">Signed index.json</a></p>\n");
  console.log("Signed Registry index and advisories");
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
