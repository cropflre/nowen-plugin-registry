# Contributing extensions

1. Publish the `.nowen-plugin` package in your own GitHub Release.
2. Sign the raw 32-byte SHA-256 digest with your Publisher Ed25519 key.
3. Add or update your public key in `publishers/<publisher>.json`.
4. Add immutable metadata in `extensions/<plugin-id>.json`.
5. Run `npm test`, `npm run check`, and `npm run verify:artifacts`.
6. Open a pull request. Maintainers bump `registry/release.json` before merge.

Public Beta accepts V2 `sandbox-js` packages and V2.1 `declarative` packages. Declarative packages must require Nowen 1.6.0 or newer, request zero permissions, and contain no executable runtime code. A previously published `(plugin id, version)` coordinate may never change its URL, digest, signature, runtime, permissions or compatibility range.

Maintainer-reviewed `nowenlab` extensions marked `official` may also publish V2 `node-action` packages, signed by an active registered Publisher key. Community and Verified Node submissions remain rejected. Installation and execution still require the application's administrator-controlled `allowNodeRuntime` policy; publication does not enable it.

Publisher private keys and Registry private keys must never be committed, attached to issues, or pasted into pull requests.
