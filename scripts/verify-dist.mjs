import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadRegistry, REPOSITORY_ROOT, verifySignedDocument } from "./lib.mjs";

try {
  const registry = await loadRegistry();
  const index = JSON.parse(await readFile(path.join(REPOSITORY_ROOT, "dist/v2/index.json"), "utf8"));
  const advisories = JSON.parse(await readFile(path.join(REPOSITORY_ROOT, "dist/v2/advisories.json"), "utf8"));
  if (index.signerKeyId !== registry.root.keyId || !verifySignedDocument(index, registry.root.publicKey)) throw new Error("dist/v2/index.json 签名无效");
  if (!verifySignedDocument(advisories, registry.root.publicKey)) throw new Error("dist/v2/advisories.json 签名无效");
  for (const advisory of index.advisories) {
    if (!verifySignedDocument(advisory, registry.root.publicKey)) throw new Error(`Advisory 签名无效: ${advisory.id}`);
  }
  console.log(`Signed Registry verified: sequence=${index.sequence}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
