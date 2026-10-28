/**
 * Pure JavaScript DES-ECB Implementation
 * 
 * Works in all JavaScript environments (Node 18+, Bun, Deno, browser, Cloudflare Workers)
 * without requiring --openssl-legacy-provider or deprecated OpenSSL algorithms.
 * Used for decrypting JioSaavn encrypted_media_url strings with key 38346591.
 */

const IP = [
  58, 50, 42, 34, 26, 18, 10, 2, 60, 52, 44, 36, 28, 20, 12, 4,
  62, 54, 46, 38, 30, 22, 14, 6, 64, 56, 48, 40, 32, 24, 16, 8,
  57, 49, 41, 33, 25, 17, 9, 1, 59, 51, 43, 35, 27, 19, 11, 3,
  61, 53, 45, 37, 29, 21, 13, 5, 63, 55, 47, 39, 31, 23, 15, 7,
];

const FP = [
  40, 8, 48, 16, 56, 24, 64, 32, 39, 7, 47, 15, 55, 23, 63, 31,
  38, 6, 46, 14, 54, 22, 62, 30, 37, 5, 45, 13, 53, 21, 61, 29,
  36, 4, 44, 12, 52, 20, 60, 28, 35, 3, 43, 11, 51, 19, 59, 27,
  34, 2, 42, 10, 50, 18, 58, 26, 33, 1, 41, 9, 49, 17, 57, 25,
];

const PC1 = [
  57, 49, 41, 33, 25, 17, 9, 1, 58, 50, 42, 34, 26, 18,
  10, 2, 59, 51, 43, 35, 27, 19, 11, 3, 60, 52, 44, 36,
  63, 55, 47, 39, 31, 23, 15, 7, 62, 54, 46, 38, 30, 22,
  14, 6, 61, 53, 45, 37, 29, 21, 13, 5, 28, 20, 12, 4,
];

const PC2 = [
  14, 17, 11, 24, 1, 5, 3, 28, 15, 6, 21, 10,
  23, 19, 12, 4, 26, 8, 16, 7, 27, 20, 13, 2,
  41, 52, 31, 37, 47, 55, 30, 40, 51, 45, 33, 48,
  44, 49, 39, 56, 34, 53, 46, 42, 50, 36, 29, 32,
];

const SHIFTS = [1, 1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1];

const E = [
  32, 1, 2, 3, 4, 5, 4, 5, 6, 7, 8, 9,
  8, 9, 10, 11, 12, 13, 12, 13, 14, 15, 16, 17,
  16, 17, 18, 19, 20, 21, 20, 21, 22, 23, 24, 25,
  24, 25, 26, 27, 28, 29, 28, 29, 30, 31, 32, 1,
];

const P = [
  16, 7, 20, 21, 29, 12, 28, 17, 1, 15, 23, 26, 5, 18, 31, 10,
  2, 8, 24, 14, 32, 27, 3, 9, 19, 13, 30, 6, 22, 11, 4, 25,
];

const S = [
  [
    [14, 4, 13, 1, 2, 15, 11, 8, 3, 10, 6, 12, 5, 9, 0, 7],
    [0, 15, 7, 4, 14, 2, 13, 1, 10, 6, 12, 11, 9, 5, 3, 8],
    [4, 1, 14, 8, 13, 6, 2, 11, 15, 12, 9, 7, 3, 10, 5, 0],
    [15, 12, 8, 2, 4, 9, 1, 7, 5, 11, 3, 14, 10, 0, 6, 13],
  ],
  [
    [15, 1, 8, 14, 6, 11, 3, 4, 9, 7, 2, 13, 12, 0, 5, 10],
    [3, 13, 4, 7, 15, 2, 8, 14, 12, 0, 1, 10, 6, 9, 11, 5],
    [0, 14, 7, 11, 10, 4, 13, 1, 5, 8, 12, 6, 9, 3, 2, 15],
    [13, 8, 10, 1, 3, 15, 4, 2, 11, 6, 7, 12, 0, 5, 14, 9],
  ],
  [
    [10, 0, 9, 14, 6, 3, 15, 5, 1, 13, 12, 7, 11, 4, 2, 8],
    [13, 7, 0, 9, 3, 4, 6, 10, 2, 8, 5, 14, 12, 11, 15, 1],
    [13, 6, 4, 9, 8, 15, 3, 0, 11, 1, 2, 12, 5, 10, 14, 7],
    [1, 10, 13, 0, 6, 9, 8, 7, 4, 15, 14, 3, 11, 5, 2, 12],
  ],
  [
    [7, 13, 14, 3, 0, 6, 9, 10, 1, 2, 8, 5, 11, 12, 4, 15],
    [13, 8, 11, 5, 6, 15, 0, 3, 4, 7, 2, 12, 1, 10, 14, 9],
    [10, 6, 9, 0, 12, 11, 7, 13, 15, 1, 3, 14, 5, 2, 8, 4],
    [3, 15, 0, 6, 10, 1, 13, 8, 9, 4, 5, 11, 12, 7, 2, 14],
  ],
  [
    [2, 12, 4, 1, 7, 10, 11, 6, 8, 5, 3, 15, 13, 0, 14, 9],
    [14, 11, 2, 12, 4, 7, 13, 1, 5, 0, 15, 10, 3, 9, 8, 6],
    [4, 2, 1, 11, 10, 13, 7, 8, 15, 9, 12, 5, 6, 3, 0, 14],
    [11, 8, 12, 7, 1, 14, 2, 13, 6, 15, 0, 9, 10, 4, 5, 3],
  ],
  [
    [12, 1, 10, 15, 9, 2, 6, 8, 0, 13, 3, 4, 14, 7, 5, 11],
    [10, 15, 4, 2, 7, 12, 9, 5, 6, 1, 13, 14, 0, 11, 3, 8],
    [9, 14, 15, 5, 2, 8, 12, 3, 7, 0, 4, 10, 1, 13, 11, 6],
    [4, 3, 2, 12, 9, 5, 15, 10, 11, 14, 1, 7, 6, 0, 8, 13],
  ],
  [
    [4, 11, 2, 14, 15, 0, 8, 13, 3, 12, 9, 7, 5, 10, 6, 1],
    [13, 0, 11, 7, 4, 9, 1, 10, 14, 3, 5, 12, 2, 15, 8, 6],
    [1, 4, 11, 13, 12, 3, 7, 14, 10, 15, 6, 8, 0, 5, 9, 2],
    [6, 11, 13, 8, 1, 4, 10, 7, 9, 5, 0, 15, 14, 2, 3, 12],
  ],
  [
    [13, 2, 8, 4, 6, 15, 11, 1, 10, 9, 3, 14, 5, 0, 12, 7],
    [1, 15, 13, 8, 10, 3, 7, 4, 12, 5, 6, 11, 0, 14, 9, 2],
    [7, 11, 4, 1, 9, 12, 14, 2, 0, 6, 10, 13, 15, 3, 5, 8],
    [2, 1, 14, 7, 4, 10, 8, 13, 15, 12, 9, 0, 3, 5, 6, 11],
  ],
];

function permute(src: number[], table: number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < table.length; i++) {
    out.push(src[table[i] - 1]);
  }
  return out;
}

function generateSubkeys(keyBits: number[]): number[][] {
  const pc1Key = permute(keyBits, PC1);
  let c = pc1Key.slice(0, 28);
  let d = pc1Key.slice(28, 56);
  const subkeys: number[][] = [];

  for (let r = 0; r < 16; r++) {
    const shift = SHIFTS[r];
    c = c.slice(shift).concat(c.slice(0, shift));
    d = d.slice(shift).concat(d.slice(0, shift));
    subkeys.push(permute(c.concat(d), PC2));
  }
  return subkeys;
}

function desBlock(blockBits: number[], subkeys: number[][], isDecrypt = true): number[] {
  const ipBlock = permute(blockBits, IP);
  let l = ipBlock.slice(0, 32);
  let r = ipBlock.slice(32, 64);

  const keys = isDecrypt ? [...subkeys].reverse() : subkeys;

  for (let round = 0; round < 16; round++) {
    const k = keys[round];
    const expR = permute(r, E);

    const xorRes = expR.map((b, i) => b ^ k[i]);

    const sboxOut: number[] = [];
    for (let s = 0; s < 8; s++) {
      const chunk = xorRes.slice(s * 6, s * 6 + 6);
      const row = (chunk[0] << 1) | chunk[5];
      const col = (chunk[1] << 3) | (chunk[2] << 2) | (chunk[3] << 1) | chunk[4];
      const val = S[s][row][col];
      for (let b = 3; b >= 0; b--) {
        sboxOut.push((val >> b) & 1);
      }
    }

    const pOut = permute(sboxOut, P);
    const nextR = l.map((b, i) => b ^ pOut[i]);
    l = r;
    r = nextR;
  }

  return permute(r.concat(l), FP);
}

function bytesToBits(bytes: Uint8Array | number[]): number[] {
  const bits: number[] = [];
  for (let i = 0; i < bytes.length; i++) {
    for (let b = 7; b >= 0; b--) {
      bits.push((bytes[i] >> b) & 1);
    }
  }
  return bits;
}

function bitsToBytes(bits: number[]): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let b = 0; b < 8; b++) {
      byte = (byte << 1) | bits[i + b];
    }
    bytes.push(byte);
  }
  return bytes;
}

function stringToBytes(str: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str, 'utf8');
  }
  return new TextEncoder().encode(str);
}

function base64ToBytes(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(base64, 'base64');
  }
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

function bytesToUtf8String(bytes: number[] | Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('utf8');
  }
  return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
}

/**
 * Decrypts a base64 encoded string using DES-ECB with the specified key.
 * Used for JioSaavn's encrypted_media_url strings (default key '38346591').
 * Universal: runs seamlessly in Node, Browser, Electron, and Capacitor Android WebView.
 */
export function decryptDesEcb(base64Data: string, keyStr = '38346591'): string {
  try {
    const keyBytes = stringToBytes(keyStr);
    const keyBits = bytesToBits(keyBytes);
    const subkeys = generateSubkeys(keyBits);

    const cipherBytes = base64ToBytes(base64Data);
    const plainBytes: number[] = [];

    for (let i = 0; i < cipherBytes.length; i += 8) {
      const chunk = cipherBytes.subarray(i, i + 8);
      if (chunk.length < 8) break;
      const blockBits = bytesToBits(chunk);
      const decBits = desBlock(blockBits, subkeys, true);
      plainBytes.push(...bitsToBytes(decBits));
    }

    // Strip PKCS7 padding
    const paddingLen = plainBytes[plainBytes.length - 1];
    if (paddingLen > 0 && paddingLen <= 8) {
      let isPkcs7 = true;
      for (let p = 1; p <= paddingLen; p++) {
        if (plainBytes[plainBytes.length - p] !== paddingLen) {
          isPkcs7 = false;
          break;
        }
      }
      if (isPkcs7) {
        plainBytes.splice(plainBytes.length - paddingLen, paddingLen);
      }
    }

    return bytesToUtf8String(plainBytes);
  } catch (err) {
    console.warn('[DES] Decryption failed:', err);
    return '';
  }
}

