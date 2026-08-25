# Security policy

Do not report signing-key exposure, malicious artifacts or Registry integrity issues in a public issue. Contact the Nowen maintainers privately and include only public identifiers, affected versions and evidence hashes until a secure channel is agreed.

If a Publisher key is compromised, revoke it in `publishers/`, publish a root-signed advisory, and do not overwrite existing version coordinates. If the Registry root is compromised, stop deployment and ship a client trust-root update or a valid root rotation signed by the previous root.
