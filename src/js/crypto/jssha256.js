/*
 *  jssha256 version 0.1  -  Copyright 2006 B. Poettering
 *
 *  This program is free software; you can redistribute it and/or
 *  modify it under the terms of the GNU General Public License as
 *  published by the Free Software Foundation; either version 2 of the
 *  License, or (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 *  General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program; if not, write to the Free Software
 *  Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA
 *  02111-1307 USA
 */

/*
 * http://point-at-infinity.org/jssha256/
 *
 * This is a JavaScript implementation of the SHA256 secure hash function
 * and the HMAC-SHA256 message authentication code (MAC).
 *
 * The routines' well-functioning has been verified with the test vectors
 * given in FIPS-180-2, Appendix B and IETF RFC 4231. The HMAC algorithm
 * conforms to IETF RFC 2104.
 *
 * The following code example computes the hash value of the string "abc".
 *
 *    SHA256_init();
 *    SHA256_write("abc");
 *    digest = SHA256_finalize();
 *    digest_hex = array_to_hex_string(digest);
 *
 * Get the same result by calling the shortcut function SHA256_hash:
 *
 *    digest_hex = SHA256_hash("abc");
 *
 * In the following example the calculation of the HMAC of the string "abc"
 * using the key "secret key" is shown:
 *
 *    HMAC_SHA256_init("secret key");
 *    HMAC_SHA256_write("abc");
 *    mac = HMAC_SHA256_finalize();
 *    mac_hex = array_to_hex_string(mac);
 *
 * Again, the same can be done more conveniently:
 *
 *    mac_hex = HMAC_SHA256_MAC("secret key", "abc");
 *
 * Note that the internal state of the hash function is held in global
 * variables. Therefore one hash value calculation has to be completed
 * before the next is begun. The same applies the the HMAC routines.
 *
 * Report bugs to: jssha256 AT point-at-infinity.org
 *
 */

/******************************************************************************/

/* The following are the SHA256 routines */

/*
   SHA256_init: initialize the internal state of the hash function. Call this
   function before calling the SHA256_write function.
*/

let SHA256_buf
let SHA256_len
let SHA256_H

/**
 * Initialize structures for hashing
 */
export function SHA256_init () {
    SHA256_H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
        0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]
    SHA256_buf = []
    SHA256_len = 0
}

/**
 *  SHA256_write: add a message fragment to the hash function's internal state.
 *  @param msg {number[]} byte array and may have arbitrary length.
 */
export function SHA256_write (msg) {
    let i
    SHA256_buf = SHA256_buf.concat(msg)
    for (i = 0; i + 64 <= SHA256_buf.length; i += 64) {
        SHA256_Hash_Byte_Block(SHA256_H, SHA256_buf.slice(i, i + 64))
    }
    SHA256_buf = SHA256_buf.slice(i)
    SHA256_len += msg.length
}

/**
 * SHA256_finalize: finalize the hash value calculation. Call this function
 * after the last call to SHA256_write.
 * @returns {number[]} byte array of 32 bytes (= 256 bits)
*/
export function SHA256_finalize () {
    let i
    SHA256_buf[SHA256_buf.length] = 0x80
    if (SHA256_buf.length > 64 - 8) {
        for (i = SHA256_buf.length; i < 64; i++) {
            SHA256_buf[i] = 0
        }
        SHA256_Hash_Byte_Block(SHA256_H, SHA256_buf)
        SHA256_buf.length = 0
    }
    for (i = SHA256_buf.length; i < 64 - 5; i++) {
        SHA256_buf[i] = 0
    }
    SHA256_buf[59] = (SHA256_len >>> 29) & 0xff
    SHA256_buf[60] = (SHA256_len >>> 21) & 0xff
    SHA256_buf[61] = (SHA256_len >>> 13) & 0xff
    SHA256_buf[62] = (SHA256_len >>> 5) & 0xff
    SHA256_buf[63] = (SHA256_len << 3) & 0xff
    SHA256_Hash_Byte_Block(SHA256_H, SHA256_buf)
    const res = new Array(32)
    for (i = 0; i < 8; i++) {
        res[4 * i + 0] = SHA256_H[i] >>> 24
        res[4 * i + 1] = (SHA256_H[i] >> 16) & 0xff
        res[4 * i + 2] = (SHA256_H[i] >> 8) & 0xff
        res[4 * i + 3] = SHA256_H[i] & 0xff
    }
    SHA256_H = undefined
    SHA256_buf = undefined
    SHA256_len = undefined
    return res
}

/**
 * SHA256_hash: calculate the hash value of byte array 'msg'. This shortcut
 * function may be more convenient than calling SHA256_init, SHA256_write,
 * SHA256_finalize.
 * @param msg {number[]} byte array to be hashed
 * @returns {number[]} hash as byte array
 */
export function SHA256_hash (msg) {
    SHA256_init()
    SHA256_write(msg)
    return SHA256_finalize()
}

/**
 * SHA256_double_hash: calculate the hash value of byte array 'block1' 'block2'
 * This shortcut function may be more convenient than calling SHA256_init(),
 * SHA256_write (block1), SHA256_write (block2), SHA256_finalize().
 * @param block1 {number[]} byte array to be hashed (first pass)
 * @param block2 {number[]} byte array to be hashed (second pass)
 * @returns {number[]} hash as byte array
 */
export function SHA256_double_hash (block1, block2) {
    SHA256_init()
    SHA256_write(block1)
    SHA256_write(block2)
    return SHA256_finalize()
}

/******************************************************************************/

/* The following lookup tables and functions are for internal use only! */

const SHA256_K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
    0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]

function SHA256_sigma0 (x) {
    return ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3)
}

function SHA256_sigma1 (x) {
    return ((x >>> 17) | (x << 15)) ^ ((x >>> 19) | (x << 13)) ^ (x >>> 10)
}

function SHA256_Sigma0 (x) {
    return ((x >>> 2) | (x << 30)) ^ ((x >>> 13) | (x << 19)) ^
    ((x >>> 22) | (x << 10))
}

function SHA256_Sigma1 (x) {
    return ((x >>> 6) | (x << 26)) ^ ((x >>> 11) | (x << 21)) ^
    ((x >>> 25) | (x << 7))
}

function SHA256_Ch (x, y, z) {
    return z ^ (x & (y ^ z))
}

function SHA256_Maj (x, y, z) {
    return (x & y) ^ (z & (x ^ y))
}

function SHA256_Hash_Word_Block (H, W) {
    let i
    for (i = 16; i < 64; i++) {
        W[i] = (SHA256_sigma1(W[i - 2]) + W[i - 7] +
      SHA256_sigma0(W[i - 15]) + W[i - 16]) & 0xffffffff
    }
    const state = H.slice()

    for (i = 0; i < 64; i++) {
        const T1 = state[7] + SHA256_Sigma1(state[4]) +
      SHA256_Ch(state[4], state[5], state[6]) + SHA256_K[i] + W[i]
        const T2 = SHA256_Sigma0(state[0]) + SHA256_Maj(state[0], state[1], state[2])
        state.pop()
        state.unshift((T1 + T2) & 0xffffffff)
        state[4] = (state[4] + T1) & 0xffffffff
    }

    for (i = 0; i < 8; i++) {
        H[i] = (H[i] + state[i]) & 0xffffffff
    }
}

function SHA256_Hash_Byte_Block (H, w) {
    const W = new Array(16)
    for (let i = 0; i < 16; i++) {
        W[i] = w[4 * i + 0] << 24 | w[4 * i + 1] << 16 |
      w[4 * i + 2] << 8 | w[4 * i + 3]
    }

    SHA256_Hash_Word_Block(H, W)
}
