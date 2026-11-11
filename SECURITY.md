# Security notes

This tool handles a Beacon Chain **private key**. Treat it as sensitive software.

* Run only on a clean, non-shared machine. Prefer disconnecting from the network after `npm ci`.
* Read `sign-bbc.mjs` before use. It has no network access, no file writes, and prints only
  `signature` and `publicKey` (public values). Audit command (should find nothing):
  `Select-String -Path *.mjs -Pattern "fetch|http|child_process|writeFile|appendFile|process.env"`
* Install exactly the pinned versions (`npm ci --ignore-scripts`); the lockfile is committed.
* Never share a private key, seed phrase or recovery signature. Nobody legitimate needs them.
  Anyone offering "recovery services" in issues or DMs is very likely a scammer.
* After use: delete the working folder and clear the clipboard history; consider the key exposed only
  if you typed it on an untrusted machine.
* Found a bug or vulnerability? Open a GitHub issue **without** any secrets, or use the repository's
  private security advisory feature.
