// sign-bbc.mjs - offline signing of the Beacon Chain recovery message.
// Usage:  node sign-bbc.mjs <bnb1-address> message.json
// The key is read from a hidden prompt, or piped on stdin (e.g. PowerShell: Get-Clipboard | node sign-bbc.mjs ...).
// The script never prints or writes the key. No network access, no file writes.
// Note: JS cannot reliably wipe the typed string from memory; close the terminal afterwards.
import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import { ripemd160 } from '@noble/hashes/ripemd160';
import { utf8ToBytes, hexToBytes, bytesToHex } from '@noble/hashes/utils';
import { bech32 } from '@scure/base';
import { readFileSync } from 'node:fs';
import readline from 'node:readline';
import { verify as nodeVerify } from 'node:crypto';

const [expectedAddr, file] = process.argv.slice(2);
if (!expectedAddr?.startsWith('bnb1') || !file) {
  console.error('Usage: node sign-bbc.mjs <bnb1...address> message.json');
  process.exit(1);
}

// The message must be signed BYTE-FOR-BYTE as the tool shows it. Do not parse or reformat it.
const message = readFileSync(file, 'utf8').replace(/^\uFEFF/, '').replace(/[\r\n]+$/, '');
try { JSON.parse(message); } catch { console.error('message file is not valid JSON - re-copy it from the tool.'); process.exit(1); }
if (!message.startsWith('{') || !message.endsWith('}')) { console.error('Message must start with { and end with }.'); process.exit(1); }
console.error(`Message: ${utf8ToBytes(message).length} bytes, sha256=${bytesToHex(sha256(utf8ToBytes(message)))}`);

function askHidden(prompt) {
  return new Promise((resolve) => {
    let answered = false;
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = () => {}; // mute echo (undocumented API; if your key echoes, abort)
    rl.on('close', () => { if (!answered) resolve(''); });
    process.stdout.write(prompt);
    rl.question('', (answer) => { answered = true; rl.close(); process.stdout.write('\n'); resolve(answer); });
  });
}

const raw = (await askHidden('Private key (hex, with or without 0x): ')).trim().replace(/^0x/i, '');
if (raw === '') { console.error('No key received (empty input, or no trailing newline when piping).'); process.exit(1); }
if (!/^[0-9a-fA-F]{64}$/.test(raw)) { console.error('Key must be 64 hex characters.'); process.exit(1); }
const priv = hexToBytes(raw);
let out;
try {
  const pub = secp256k1.getPublicKey(priv, true); // 33-byte compressed
  const addr = bech32.encode('bnb', bech32.toWords(ripemd160(sha256(pub))));
  if (addr !== expectedAddr) throw new Error(`MISMATCH: this key controls ${addr}, not ${expectedAddr}. Nothing signed.`);
  const digest = sha256(utf8ToBytes(message));
  const sig = secp256k1.sign(digest, priv); // deterministic (RFC6979), low-S
  if (!secp256k1.verify(sig, digest, pub)) throw new Error('Self-verification failed.');
  // Independent check with Node's built-in OpenSSL (hashes the raw message itself with SHA-256).
  const xy = secp256k1.ProjectivePoint.fromHex(pub).toRawBytes(false);
  const jwk = { kty: 'EC', crv: 'secp256k1', x: Buffer.from(xy.slice(1, 33)).toString('base64url'), y: Buffer.from(xy.slice(33)).toString('base64url') };
  const okNode = nodeVerify('sha256', Buffer.from(message, 'utf8'), { key: jwk, format: 'jwk', dsaEncoding: 'ieee-p1363' }, Buffer.from(sig.toCompactRawBytes()));
  if (!okNode) throw new Error('Independent node:crypto verification FAILED - do not use this signature.');
  out = { signature: '0x' + bytesToHex(sig.toCompactRawBytes()), publicKey: '0x' + bytesToHex(pub) };
} catch (e) {
  console.error(e.message); process.exitCode = 1;
} finally {
  priv.fill(0); // zeroes this byte array only
}
if (out) console.log(JSON.stringify(out, null, 2));
