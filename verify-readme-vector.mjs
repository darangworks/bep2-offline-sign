// Reproduces the check against the official sample (values as shown in the official tool's README:
// https://github.com/bnb-chain/token-recover-self-service-tools). Compare them yourself.
import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import { ripemd160 } from '@noble/hashes/ripemd160';
import { utf8ToBytes, hexToBytes } from '@noble/hashes/utils';
import { bech32 } from '@scure/base';
import { verify } from 'node:crypto';
const msg = '{"account_number":"0","chain_id":"Binance-Chain-Tigris","data":null,"memo":"","msgs":[{"amount":"00000000000000000000000000000000000000000000000000000000000003e8","recipient":"0x441de55a37f6c381b00db8b52df8f57794784a1a","token_symbol":"43414b452d343335000000000000000000000000000000000000000000000000"}],"sequence":"0","source":"0"}';
const sig = hexToBytes('e4838ff411975a210cb15d5c950b53835f5d5bb7b0ebb8dbc4515541bb01181e408f7cbbdab08c9278a623667909e8c3c39fee8c3df65de65df4aec0c48f4196');
const pub = hexToBytes('030771d42cc0a93289bf457e575bdb42c0d56fcf5953df6614b1b7de2986ce941c');
const xy = secp256k1.ProjectivePoint.fromHex(pub).toRawBytes(false);
const jwk = { kty: 'EC', crv: 'secp256k1', x: Buffer.from(xy.slice(1, 33)).toString('base64url'), y: Buffer.from(xy.slice(33)).toString('base64url') };
console.log('noble  :', secp256k1.verify(sig, sha256(utf8ToBytes(msg)), pub));
console.log('OpenSSL:', verify('sha256', Buffer.from(msg), { key: jwk, format: 'jwk', dsaEncoding: 'ieee-p1363' }, Buffer.from(sig)));
console.log('address:', bech32.encode('bnb', bech32.toWords(ripemd160(sha256(pub))));
