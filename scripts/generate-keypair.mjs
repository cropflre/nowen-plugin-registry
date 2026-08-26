import crypto from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { REPOSITORY_ROOT } from "./lib.mjs";

function option(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const name = option("name");
if (!name || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(name)) {
  throw new Error("用法: npm run keys:generate -- --name <key-name>");
}

const outputDirectory = path.join(REPOSITORY_ROOT, ".secrets");
const privateKeyPath = path.join(outputDirectory, `${name}-private.pem`);
const publicKeyPath = path.join(outputDirectory, `${name}-public.pem`);
const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
const privatePem = privateKey.export({ type: "pkcs8", format: "pem" });
const publicPem = publicKey.export({ type: "spki", format: "pem" });

await mkdir(outputDirectory, { recursive: true });
await writeFile(privateKeyPath, privatePem, { encoding: "utf8", flag: "wx", mode: 0o600 });
try {
  await writeFile(publicKeyPath, publicPem, { encoding: "utf8", flag: "wx", mode: 0o644 });
} catch (error) {
  throw new Error(`公钥写入失败，私钥已保留在 ${privateKeyPath}: ${error.message}`);
}

const fingerprint = crypto.createHash("sha256").update(publicPem).digest("hex");
console.log(`Generated ${name}`);
console.log(`Private key: ${path.relative(REPOSITORY_ROOT, privateKeyPath)}`);
console.log(`Public key: ${path.relative(REPOSITORY_ROOT, publicKeyPath)}`);
console.log(`Public key SHA256: ${fingerprint}`);
