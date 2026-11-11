# bep2-offline-sign

Unofficial, offline signer for the **BNB Beacon Chain Token Recover Self-Service Tool**
(<https://github.com/bnb-chain/token-recover-self-service-tools>), for people who cannot use the
Trust Wallet browser extension the tool expects (`bnbSign`).

[فارسی](README.fa.md)

> **Not affiliated with BNB Chain, Binance or Trust Wallet. Use at your own risk.**
> This handles a **private key**. Read the code (about 60 lines, no network access, no file writes),
> run it on a clean, non-shared machine, and never paste your key, seed phrase or signatures into
> chats, issues or websites.

## What it does

The official tool's Step 2 produces a JSON message. Normally the wallet extension signs it. This script
signs the **same bytes** offline and prints `signature` and `publicKey`, which you paste into Step 3
(the tool has manual input fields).

* Signature scheme: `secp256k1`, ECDSA over **one SHA-256 of the exact UTF-8 JSON string**, 64-byte
  compact `r||s` (RFC 6979, low-S), public key 33-byte compressed. Both are printed with a `0x` prefix.
* Verified against the sample signature and public key shown in the official tool's README
  (`npm run verify-vector` -> `noble: true`, `OpenSSL: true`, and the derived `bnb1…` address matches).
* Before printing, the script (1) derives your `bnb1…` address from the key and aborts on mismatch,
  (2) verifies the signature with noble, and (3) re-verifies it independently with Node's built-in
  OpenSSL, which hashes the raw message itself (this catches double-hashing from library-version changes).

What this does **not** prove: that the server accepts your request. Only Step 3 shows that, and Step 3
sends no transaction.

## Why I built it and real-world validation

I built this tool because I could not find an available tool for producing **the exact signature required by this recovery flow and independently verifying that signature** when the expected Trust Wallet browser extension was unavailable. This project provides an offline signing path and checks the result with two independent verification implementations.

I also previously tested the recovery process successfully with a **real balance**, recovering assets from BNB Beacon Chain to BNB Smart Chain (BSC). The recovery service's status endpoint for that test is available here: [Check the recovery API response](https://mainnet-token-recover-api.bnbchain.org/api/recover/token/bnb136uztmqa2vtdtedtjpfv7hyszpdkd9xmaj7yjy?symbol=BNB).

That practical result validates the recovery flow I tested; it is not an independent security audit of this signer, and the API response may change as the recovery status changes.

## Requirements

* Node.js 24+ (tested on Windows PowerShell)
* The official tool cloned **only** from <https://github.com/bnb-chain/token-recover-self-service-tools>
* A BSC wallet (e.g. MetaMask) that will be the recipient and has a little BNB for gas

## Install

```powershell
git clone https://github.com/darangworks/bep2-offline-sign.git
cd bep2-offline-sign
npm ci --ignore-scripts
npm ls --depth=0        # expect @noble/curves@1.9.7  @noble/hashes@1.8.0  @scure/base@1.2.6
npm run verify-vector   # expect noble: true / OpenSSL: true
```

## Automated checks (GitHub Actions)

GitHub Actions runs the regression check on every push and pull request (and can also be started manually). It installs the exact locked dependencies with lifecycle scripts disabled, runs `npm run verify-vector` to check the published sample signature independently with **noble and OpenSSL**, and reports the installed dependency versions.

This is a reproducibility/regression check only—not an independent security audit, and not proof that the recovery service will accept a request. The workflow does not use or request your private key.

Workflow: [`.github/workflows/verify-vector.yml`](.github/workflows/verify-vector.yml).

## Use

1. Run the official tool, do **Step 1** (address -> list) and **Step 2** (token, amount, BSC address,
   `Generate Sign Message`). Skip "Sign with Wallet".
2. Save the JSON message in a file (e.g. `message.json`) with Notepad, as a single line, no edits.
   Compact one-line JSON for the same fields is about 332 bytes.
3. Check the fields: `amount` (hex), `token_symbol` (hex), `recipient` = **your** BSC address.
4. Sign. Some terminals do not accept paste into the hidden prompt; piping from the clipboard avoids that:

   ```powershell
   Get-Clipboard | node sign-bbc.mjs bnb1YOUR_ADDRESS message.json
   ```
   (or run `node sign-bbc.mjs bnb1YOUR_ADDRESS message.json` and type/paste at the hidden prompt).
   It prints `Message: N bytes, sha256=…`, then `signature` and `publicKey`.
5. Clear the clipboard and the Windows clipboard history (`Win+V` -> Clear all). Save the two values
   somewhere temporary before that.
6. Optional sanity check of the values you are about to paste (public values only, no key needed):
   `node check-pasted.mjs 0xPUBLICKEY 0xSIGNATURE message.json bnb1YOUR_ADDRESS`
7. **Step 3** in the tool: symbol, `publicKey`, `signature`, BSC address -> `Get Approval`.
   Success returns `proofs` and `approval_signature` (nothing has been sent on-chain yet).
8. **Step 4** `Generate Payload`, then send `recover` from your BSC wallet to the recovery contract
   (see the official guide for the address and gas settings), e.g. via the BscScan "Write Contract" tab.
   The function selector `0xbfb5a6a1` corresponds to
   `recover(bytes32,uint256,bytes,bytes,bytes,bytes32[])`; argument order:
   `tokenSymbol, amount, ownerPubKey, ownerSignature, approvalSignature, merkleProof`.
   Only use `recover`; the other functions on that contract are administrative.

## After the transaction: expect a waiting period

A successful `recover` only **locks** the amount (`TokenRecoverLocked` event with an `unlockAt` timestamp,
7 days later). Funds were not credited immediately. The official repo documents a total wait of about 30 days
(7-day lock + ~23-day processing; see the repo's merged docs PR on the waiting period). Do **not** repeat
`recover`. You can check the state (read-only):

```
https://mainnet-token-recover-api.bnbchain.org/api/recover/token/bnb1YOUR_ADDRESS?symbol=BNB
```

Users report `status` 4 = Locked and 6 = Unlocked (from issue reports, not official docs).

## Troubleshooting

* `Key must be 64 hex characters` - the pasted text is not a raw 64-hex key (wrong format, wrapped
  line, or paste not accepted by the hidden prompt). Use the pipe method above.
* `MISMATCH: this key controls bnb1…` - the key belongs to a different address. Nothing was signed.
* Step 3 `record not found` - seen once; a later attempt with the same signature succeeded. Cause unknown.
  Check symbol/address fields, don't re-sign unless the message changed, and keep the official repo's issues in mind.
* Step 3 `verify signature failed` - make sure Steps 2 and 3 use identical inputs and that the signed
  message is byte-identical to the one the tool generated.

## Limitations

* JavaScript cannot reliably wipe the typed key string from memory; close the terminal afterwards.
* Hidden prompt uses an undocumented readline hook; if your key echoes, abort.
* Tested only for native BNB on Windows PowerShell. Other BEP2/BEP8 tokens and platforms are untested.
* No hardware-wallet support.
* Independent audit has not been done. See [SECURITY.md](SECURITY.md).

License: MIT
