// check-pasted.mjs - checks the PUBLIC values you pasted into Step 3. No private key needed.
// Usage: node check-pasted.mjs <publicKey> <signature> message.json [expected-bnb1-address]
import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import { ripemd160 } from '@noble/hashes/ripemd160';
import { utf8ToBytes, hexToBytes } from '@noble/hashes/utils';
import { bech32 } from '@scure/base';
import { readFileSync } from 'node:fs';

const [pubArg, sigArg, file, expected] = process.argv.slice(2);
if (!pubArg || !sigArg || !file) { console.error('Usage: node check-pasted.mjs <publicKey> <signature> message.json [bnb1...]'); process.exit(1); }

const message = readFileSync(file, 'utf8').replace(/^\uFEFF/, '').replace(/[\r\n]+$/, '');
const hexOk = (s, n) => new RegExp(`^0x[0-9a-fA-F]{${n}}$`).test(s);

console.log(`publicKey : ${pubArg.length} chars (expect 68), format ok: ${hexOk(pubArg, 66)}`);
console.log(`signature : ${sigArg.length} chars (expect 130), format ok: ${hexOk(sigArg, 128)}`);
if (!hexOk(pubArg, 66) || !hexOk(sigArg, 128)) { console.log('=> A value is malformed (extra spaces/line breaks, missing chars, or no 0x). Re-copy it.'); process.exit(1); }

const pub = hexToBytes(pubArg.slice(2));
const sig = hexToBytes(sigArg.slice(2));
const addr = bech32.encode('bnb', bech32.toWords(ripemd160(sha256(pub))));
console.log(`address from publicKey: ${addr}`);
if (expected) console.log(`matches expected ${expected}: ${addr === expected}`);
console.log(`signature valid for message: ${secp256k1.verify(sig, sha256(utf8ToBytes(message)), pub)}`);
