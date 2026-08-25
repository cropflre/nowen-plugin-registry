import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { REPOSITORY_ROOT } from "./lib.mjs";

const target = path.join(REPOSITORY_ROOT, "registry/release.json");
const release = JSON.parse(await readFile(target, "utf8"));
const now = new Date();
const expires = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
const next = {
  sequence: Number(release.sequence) + 1,
  generatedAt: now.toISOString(),
  expiresAt: expires.toISOString(),
};
const temporary = `${target}.${process.pid}.tmp`;
await writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o644 });
await rename(temporary, target);
console.log(`Registry release bumped to sequence ${next.sequence}, expires ${next.expiresAt}`);
