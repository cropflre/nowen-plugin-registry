import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { canonicalJson, signDocument, verifySignedDocument } from "../scripts/lib.mjs";

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
