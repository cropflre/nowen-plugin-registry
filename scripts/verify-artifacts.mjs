import crypto from "node:crypto";
import { loadRegistry } from "./lib.mjs";

const MAX_BYTES = 20 * 1024 * 1024;

try {
  const registry = await loadRegistry();
  let count = 0;
  for (const extension of registry.extensions) {
    for (const version of extension.versions) {
      const response = await fetch(version.artifactUrl, { redirect: "follow", signal: AbortSignal.timeout(30_000) });
      if (!response.ok) throw new Error(`${extension.id}@${version.version} Artifact HTTP ${response.status}`);
      const declared = Number(response.headers.get("content-length") || 0);
      if (declared > MAX_BYTES) throw new Error(`${extension.id}@${version.version} Artifact 超过 20MB`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.byteLength > MAX_BYTES) throw new Error(`${extension.id}@${version.version} Artifact 超过 20MB`);
      const digest = crypto.createHash("sha256").update(bytes).digest("hex");
      if (digest !== version.sha256) throw new Error(`${extension.id}@${version.version} Artifact SHA256 不匹配`);
      count += 1;
    }
  }
  console.log(`Verified ${count} GitHub Release artifacts`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
