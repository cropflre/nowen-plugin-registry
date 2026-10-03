import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { canonicalJson, signDocument, validatePublicRuntime, verifySignedDocument } from "../scripts/lib.mjs";

test("canonical JSON recursively sorts object keys", () => {
  assert.equal(canonicalJson({ z: 1, a: { y: 2, b: 3 }, list: [{ d: 4, c: 5 }] }), '{"a":{"b":3,"y":2},"list":[{"c":5,"d":4}],"z":1}');
});

test("Registry documents use the same Ed25519 canonical signature contract as Nowen", () => {
  const pair = crypto.generateKeyPairSync("ed25519");
  const signed = signDocument({ protocolVersion: 2, sequence: 1, extensions: [] }, pair.privateKey);
  assert.equal(verifySignedDocument(signed, pair.publicKey), true);
  assert.equal(verifySignedDocument({ ...signed, sequence: 2 }, pair.publicKey), false);
});

test("Publisher signatures cover the raw SHA256 digest", () => {
  const pair = crypto.generateKeyPairSync("ed25519");
  const digest = crypto.createHash("sha256").update("artifact").digest();
  const signature = crypto.sign(null, digest, pair.privateKey);
  assert.equal(crypto.verify(null, digest, pair.publicKey, signature), true);
  assert.equal(crypto.verify(null, crypto.createHash("sha256").update("tampered").digest(), pair.publicKey, signature), false);
});

test("Public Registry accepts zero-permission V2.1 declarative packages", () => {
  assert.doesNotThrow(() => validatePublicRuntime({
    apiVersion: 2,
    runtime: "declarative",
    nowen: ">=1.6.0 <2.0.0",
    permissions: [],
  }, "nowenlab.theme-pack@1.0.0"));

  assert.throws(() => validatePublicRuntime({
    apiVersion: 2,
    runtime: "declarative",
    nowen: ">=1.6.0 <2.0.0",
    permissions: ["notes:read"],
  }, "nowenlab.theme-pack@1.0.0"), /不能请求权限/);

  assert.throws(() => validatePublicRuntime({
    apiVersion: 2,
    runtime: "declarative",
    nowen: ">=1.5.0 <2.0.0",
    permissions: [],
  }, "nowenlab.theme-pack@1.0.0"), /Nowen >=1\.6\.0/);
});

test("Node publication is limited to signed nowenlab official metadata", () => {
  const version = { apiVersion: 2, runtime: "node-action", nowen: ">=1.5.0 <2.0.0", permissions: ["capture:write"] };
  const coordinate = "nowenlab.wechat-capture@1.0.0";
  assert.doesNotThrow(() => validatePublicRuntime(version, coordinate, { publisher: "nowenlab", trustLevel: "official" }));
  for (const extension of [{}, { publisher: "nowenlab", trustLevel: "community" }, { publisher: "nowenlab", trustLevel: "verified" }, { publisher: "other", trustLevel: "official" }]) {
    assert.throws(() => validatePublicRuntime(version, coordinate, extension), /nowenlab 官方 Node/);
  }
  assert.throws(() => validatePublicRuntime({ ...version, apiVersion: 1 }, coordinate, { publisher: "nowenlab", trustLevel: "official" }), /Public Beta/);
});
