# Nowen Plugin Registry

The official static Registry for Nowen Extension Platform V2. GitHub Pages serves signed metadata; plugin packages remain immutable GitHub Release artifacts.

## Trust model

GitHub is transport and hosting, not the trust root. Nowen verifies:

1. the compiled Registry Ed25519 root;
2. the canonical JSON Registry signature;
3. the active Publisher key;
4. the artifact SHA-256 and Publisher signature;
5. Manifest identity, compatibility, sandbox runtime, permissions and advisories.

The public index is deployed to:

`https://cropflre.github.io/nowen-plugin-registry/v2/index.json`

## Repository layout

- `publishers/*.json`: Publisher namespaces and public Ed25519 keys.
- `extensions/*.json`: immutable version metadata and GitHub Release URLs.
- `advisories/*.json`: advisory drafts signed during deployment.
- `registry/root.json`: public Registry root metadata.
- `registry/release.json`: monotonic sequence and validity window.
- `schemas/`: public JSON Schemas.
- `scripts/`: validation, deterministic build, signing and artifact checks.

## Local validation

```bash
npm test
npm run check
npm run build
npm run sign
npm run verify:dist
```

`npm run sign` uses `.secrets/registry-root-private.pem` locally or `NOWEN_REGISTRY_SIGNING_PRIVATE_KEY` in protected CI. Private keys are ignored and must never be committed.

Generate a new Ed25519 key pair only before the corresponding public key ships in a Nowen release:

```bash
npm run keys:generate -- --name registry-root
npm run keys:generate -- --name nowenlab-2026
```

The command refuses to overwrite existing key files. Back up private keys offline before adding the Registry private PEM to GitHub Actions or using the Publisher private PEM to sign an artifact.

Before publishing changed metadata, bump the signed release envelope:

```bash
npm run release:bump
```

Every content change must use a strictly higher sequence. Reusing a sequence with different content is intentionally rejected by Nowen as Registry equivocation.

The monthly `refresh-metadata` workflow opens a pull request that advances the sequence and renews the 90-day validity window. It does not push directly to protected `main`.

## GitHub setup

1. Create `cropflre/nowen-plugin-registry` and push this repository.
2. Add the complete Registry private PEM as the `NOWEN_REGISTRY_SIGNING_PRIVATE_KEY` repository secret.
3. In Settings → Pages, choose GitHub Actions as the source.
4. Protect `main`: require `validate`, disallow force pushes, and require review.
5. Run the Pages workflow once, then verify `/v2/index.json` before shipping a client with the compiled public root.

For a mainland mirror, copy `dist/` byte-for-byte. The mirror does not receive any signing key.
