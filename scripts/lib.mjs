import crypto from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)+$/;
export const PUBLISHER_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
export const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
export const SHA256_PATTERN = /^[a-f0-9]{64}$/;
export const ALLOWED_TRUST_LEVELS = new Set(["official", "verified", "community"]);
export const ALLOWED_PUBLIC_RUNTIMES = new Set(["sandbox-js", "declarative"]);

export function fail(message) {
  throw new Error(message);
}

export function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}

export function signDocument(document, privateKey) {
  const unsigned = { ...document };
  delete unsigned.signature;
  return {
    ...unsigned,
    signature: crypto.sign(null, Buffer.from(canonicalJson(unsigned)), privateKey).toString("base64"),
  };
}

export function verifySignedDocument(document, publicKey) {
  const unsigned = { ...document };
  const signature = unsigned.signature;
  delete unsigned.signature;
  return typeof signature === "string" && crypto.verify(
    null,
    Buffer.from(canonicalJson(unsigned)),
    publicKey,
    Buffer.from(signature, "base64"),
  );
}

export function assertEd25519PublicKey(value, label) {
  try {
    const key = crypto.createPublicKey(value);
    if (key.asymmetricKeyType !== "ed25519") fail(`${label} 必须是 Ed25519 公钥`);
  } catch (error) {
    if (error instanceof Error && error.message.includes("必须是")) throw error;
    fail(`${label} 不是有效公钥`);
  }
}

export function assertIsoRange(validFrom, validUntil, label) {
  const start = Date.parse(validFrom);
  const end = Date.parse(validUntil);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) fail(`${label} 有效期无效`);
}

function parseVersion(value) {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(value);
  return match ? match.slice(1).map(Number) : null;
}

function compareVersion(left, right) {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

function nowenVersionSatisfies(range, current) {
  const actual = parseVersion(current);
  if (!actual) return false;
  return range.trim().split(/\s+/).every((clause) => {
    const match = /^(>=|<=|>|<|=|\^|~)?(\d+\.\d+\.\d+)$/.exec(clause);
    if (!match) return false;
    const expected = parseVersion(match[2]);
    if (!expected) return false;
    const comparison = compareVersion(actual, expected);
    switch (match[1] || "=") {
      case ">=": return comparison >= 0;
      case "<=": return comparison <= 0;
      case ">": return comparison > 0;
      case "<": return comparison < 0;
      case "^": return actual[0] === expected[0] && comparison >= 0;
      case "~": return actual[0] === expected[0] && actual[1] === expected[1] && comparison >= 0;
      default: return comparison === 0;
    }
  });
}

export function validatePublicRuntime(version, coordinate) {
  if (version.apiVersion !== 2 || !ALLOWED_PUBLIC_RUNTIMES.has(version.runtime)) {
    fail(`${coordinate} Public Beta 只接受 V2 sandbox-js 或 declarative`);
  }
  if (version.runtime === "declarative") {
    if (!Array.isArray(version.permissions) || version.permissions.length > 0) fail(`${coordinate} declarative 不能请求权限`);
    if (!nowenVersionSatisfies(version.nowen || "", "1.6.0") || nowenVersionSatisfies(version.nowen || "", "1.5.0")) {
      fail(`${coordinate} declarative 必须要求 Nowen >=1.6.0`);
    }
  }
}

export function assertHttpsUrl(value, label, options = {}) {
  let url;
  try { url = new URL(value); } catch { fail(`${label} 不是有效 URL`); }
  if (url.protocol !== "https:" || url.username || url.password || url.hash) {
    fail(`${label} 必须是无凭证、无 fragment 的 HTTPS URL`);
  }
  if (options.githubRelease && (url.hostname !== "github.com" || !/\/releases\/download\//.test(url.pathname))) {
    fail(`${label} 必须指向 GitHub Release Artifact`);
  }
  return url;
}

export async function readJson(file) {
  try { return JSON.parse(await readFile(file, "utf8")); }
  catch (error) { fail(`${path.relative(REPOSITORY_ROOT, file)} 不是有效 JSON: ${error.message}`); }
}

async function readJsonDirectory(directory) {
  const entries = (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json") && !entry.name.startsWith("."))
    .sort((left, right) => left.name.localeCompare(right.name));
  return Promise.all(entries.map(async (entry) => ({
    file: path.join(directory, entry.name),
    value: await readJson(path.join(directory, entry.name)),
  })));
}

function validateRoot(root) {
  if (!root || typeof root !== "object" || Array.isArray(root)) fail("registry/root.json 必须是对象");
  if (root.sourceId !== "official-v2" || !root.sourceName || !root.keyId) fail("Registry Root 标识无效");
  if (root.algorithm !== "Ed25519" || root.state !== "active" || !Number.isSafeInteger(root.sequence) || root.sequence < 0) fail("Registry Root 算法、状态或 sequence 无效");
  assertHttpsUrl(root.indexUrl, "Registry indexUrl");
  assertEd25519PublicKey(root.publicKey, "Registry Root");
  assertIsoRange(root.validFrom, root.validUntil, "Registry Root");
  return root;
}

function validateRelease(release, root) {
  if (!release || typeof release !== "object" || !Number.isSafeInteger(release.sequence) || release.sequence < root.sequence) fail("Registry release sequence 无效");
  assertIsoRange(release.generatedAt, release.expiresAt, "Registry release");
  return release;
}

function validatePublishers(rows) {
  const publisherIds = new Set();
  const keys = new Map();
  for (const { file, value } of rows) {
    const label = path.relative(REPOSITORY_ROOT, file);
    if (!value || typeof value !== "object" || !PUBLISHER_PATTERN.test(value.publisher || "") || !value.name || !Array.isArray(value.keys) || value.keys.length === 0) fail(`${label} Publisher 元数据无效`);
    if (publisherIds.has(value.publisher)) fail(`Publisher 重复: ${value.publisher}`);
    publisherIds.add(value.publisher);
    for (const key of value.keys) {
      if (!key.keyId || keys.has(key.keyId) || !["active", "revoked"].includes(key.state)) fail(`${label} Publisher Key 无效或重复`);
      assertEd25519PublicKey(key.publicKey, `${label}/${key.keyId}`);
      assertIsoRange(key.validFrom, key.validUntil, `${label}/${key.keyId}`);
      keys.set(key.keyId, { ...key, publisher: value.publisher });
    }
    if (value.keys.filter((key) => key.state === "active").length === 0) fail(`${label} 至少需要一个 active key`);
  }
  return { publisherIds, keys };
}

function validateExtension(extension, label, publishers) {
  if (!extension || typeof extension !== "object" || !ID_PATTERN.test(extension.id || "") || !PUBLISHER_PATTERN.test(extension.publisher || "") || !extension.id.startsWith(`${extension.publisher}.`)) fail(`${label} 插件 ID/Publisher namespace 无效`);
  if (!publishers.publisherIds.has(extension.publisher) || !extension.name || !Array.isArray(extension.versions) || extension.versions.length === 0) fail(`${label} 插件元数据无效`);
  if (extension.trustLevel !== undefined && !ALLOWED_TRUST_LEVELS.has(extension.trustLevel)) fail(`${label} trustLevel 无效`);
  if (extension.repository) assertHttpsUrl(extension.repository, `${label} repository`);
  if (extension.homepage) assertHttpsUrl(extension.homepage, `${label} homepage`);
  const versions = new Set();
  for (const version of extension.versions) {
    const coordinate = `${extension.id}@${version.version || "?"}`;
    if (!SEMVER_PATTERN.test(version.version || "") || versions.has(version.version)) fail(`${coordinate} 版本无效或重复`);
    versions.add(version.version);
    validatePublicRuntime(version, coordinate);
    assertHttpsUrl(version.artifactUrl, `${coordinate} artifactUrl`, { githubRelease: true });
    if (!SHA256_PATTERN.test(version.sha256 || "") || typeof version.signature !== "string" || !version.signature) fail(`${coordinate} SHA256/签名无效`);
    const key = publishers.keys.get(version.publisherKeyId);
    if (!key || key.publisher !== extension.publisher || key.state !== "active") fail(`${coordinate} Publisher Key 不可用`);
    if (!crypto.verify(null, Buffer.from(version.sha256, "hex"), key.publicKey, Buffer.from(version.signature, "base64"))) fail(`${coordinate} Publisher 签名无效`);
    if (typeof version.nowen !== "string" || !version.nowen.trim() || !Array.isArray(version.permissions) || version.permissions.some((permission) => typeof permission !== "string")) fail(`${coordinate} 兼容范围或权限无效`);
  }
  return extension;
}

function validateAdvisory(advisory, label) {
  if (!advisory || typeof advisory !== "object" || !advisory.id || !Number.isSafeInteger(advisory.sequence) || advisory.sequence < 0 || !ID_PATTERN.test(advisory.pluginId || "")) fail(`${label} Advisory 标识无效`);
  if (!advisory.affectedVersionRange || !["critical", "high", "medium", "low"].includes(advisory.severity) || !["disable", "recommend", "warn", "info"].includes(advisory.action)) fail(`${label} Advisory 范围或级别无效`);
  if (!advisory.title || !["active", "withdrawn"].includes(advisory.state) || !(advisory.replaces === null || typeof advisory.replaces === "string")) fail(`${label} Advisory 状态无效`);
  assertIsoRange(advisory.issuedAt, advisory.expiresAt, label);
  if (advisory.detailsUrl) assertHttpsUrl(advisory.detailsUrl, `${label} detailsUrl`);
  const unsigned = { ...advisory };
  delete unsigned.signerKeyId;
  delete unsigned.signature;
  return unsigned;
}

export async function loadRegistry(rootDirectory = REPOSITORY_ROOT) {
  const root = validateRoot(await readJson(path.join(rootDirectory, "registry/root.json")));
  const release = validateRelease(await readJson(path.join(rootDirectory, "registry/release.json")), root);
  const publisherRows = await readJsonDirectory(path.join(rootDirectory, "publishers"));
  const publishers = validatePublishers(publisherRows);
  const extensionRows = await readJsonDirectory(path.join(rootDirectory, "extensions"));
  const extensionIds = new Set();
  const extensions = extensionRows.map(({ file, value }) => {
    const extension = validateExtension(value, path.relative(rootDirectory, file), publishers);
    if (extensionIds.has(extension.id)) fail(`Extension 重复: ${extension.id}`);
    extensionIds.add(extension.id);
    return extension;
  }).sort((left, right) => left.id.localeCompare(right.id));
  const advisoryRows = await readJsonDirectory(path.join(rootDirectory, "advisories"));
  const advisoryIds = new Set();
  const advisories = advisoryRows.map(({ file, value }) => {
    const advisory = validateAdvisory(value, path.relative(rootDirectory, file));
    if (advisoryIds.has(advisory.id)) fail(`Advisory 重复: ${advisory.id}`);
    advisoryIds.add(advisory.id);
    return advisory;
  }).sort((left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id));
  const flattenedPublishers = [...publishers.keys.values()]
    .map(({ publisher, keyId, publicKey, state, validFrom, validUntil }) => ({ publisher, keyId, publicKey, state, validFrom, validUntil }))
    .sort((left, right) => left.publisher.localeCompare(right.publisher) || left.keyId.localeCompare(right.keyId));
  return { rootDirectory, root, release, publishers: flattenedPublishers, extensions, advisories };
}

export function unsignedIndex(registry) {
  return {
    protocolVersion: 2,
    sequence: registry.release.sequence,
    generatedAt: registry.release.generatedAt,
    expiresAt: registry.release.expiresAt,
    signerKeyId: registry.root.keyId,
    rootRotations: [],
    publishers: registry.publishers,
    extensions: registry.extensions,
    advisories: registry.advisories,
  };
}

export function privateKeyFromEnvironmentOrFile(rootDirectory, keyArgument) {
  const inline = process.env.NOWEN_REGISTRY_SIGNING_PRIVATE_KEY;
  const pem = inline || null;
  return pem ? Promise.resolve(pem) : readFile(path.resolve(rootDirectory, keyArgument || ".secrets/registry-root-private.pem"), "utf8");
}

export function assertPrivateKeyMatches(publicKey, privateKeyPem) {
  const privateKey = crypto.createPrivateKey(privateKeyPem);
  if (privateKey.asymmetricKeyType !== "ed25519") fail("Registry 私钥必须是 Ed25519");
  const derived = crypto.createPublicKey(privateKey).export({ type: "spki", format: "pem" }).toString();
  const expected = crypto.createPublicKey(publicKey).export({ type: "spki", format: "pem" }).toString();
  if (derived !== expected) fail("Registry 私钥与 registry/root.json 公钥不匹配");
  return privateKey;
}
