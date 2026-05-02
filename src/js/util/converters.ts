
/* global BigInteger */

export default {
    charToNibble: {
        0: 0,
        1: 1,
        2: 2,
        3: 3,
        4: 4,
        5: 5,
        6: 6,
        7: 7,
        8: 8,
        9: 9,
        a: 10,
        A: 10,
        b: 11,
        B: 11,
        c: 12,
        C: 12,
        d: 13,
        D: 13,
        e: 14,
        E: 14,
        f: 15,
        F: 15
    },
    nibbleToChar: [
        '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'
    ],
    byteArrayToHexString (bytes) {
        let str = ''
        for (let i = 0; i < bytes.length; ++i) {
            if (bytes[i] < 0) {
                bytes[i] += 256
            }
            str += this.nibbleToChar[bytes[i] >> 4] + this.nibbleToChar[bytes[i] & 0x0F]
        }
        return str
    },
    stringToByteArray (str) {
        const encoder = new TextEncoder()
        return Array.from(encoder.encode(str))
    },
    hexStringToByteArray (str) {
        const bytes = []
        let i = 0
        if (str.length % 2 !== 0) {
            bytes.push(this.charToNibble[str.charAt(0)])
            ++i
        }
        for (; i < str.length - 1; i += 2) {
            bytes.push((this.charToNibble[str.charAt(i)] << 4) + this.charToNibble[str.charAt(i + 1)])
        }
        return bytes
    },
    stringToHexString (str) {
        return this.byteArrayToHexString(this.stringToByteArray(str))
    },
    hexStringToString (hex) {
        return this.byteArrayToString(this.hexStringToByteArray(hex))
    },
    checkBytesToIntInput (bytes, numBytes, opt_startIndex) {
        const startIndex = opt_startIndex || 0
        if (startIndex < 0) {
            throw new Error('Start index should not be negative')
        }

        if (bytes.length < startIndex + numBytes) {
            throw new Error('Need at least ' + (numBytes) + ' bytes to convert to an integer')
        }
        return startIndex
    },
    byteArrayToSignedShort (bytes, opt_startIndex) {
        const index = this.checkBytesToIntInput(bytes, 2, opt_startIndex)
        let value = bytes[index]
        value += bytes[index + 1] << 8
        return value
    },
    byteArrayToSignedInt32 (bytes, opt_startIndex) {
        const index = this.checkBytesToIntInput(bytes, 4, opt_startIndex)
        let value = bytes[index]
        value += bytes[index + 1] << 8
        value += bytes[index + 2] << 16
        value += bytes[index + 3] << 24
        return value
    },
    byteArrayToBigInteger (bytes, opt_startIndex) {
        const index = this.checkBytesToIntInput(bytes, 8, opt_startIndex)
        let value = new BigInteger('0', 10)
        let temp1, temp2
        for (let i = 7; i >= 0; i--) {
            temp1 = value.multiply(new BigInteger('256', 10))
            temp2 = temp1.add(new BigInteger(bytes[index + i].toString(10), 10))
            value = temp2
        }
        return value
    },
    // create a wordArray that is Big-Endian
    byteArrayToWordArray (byteArray) {
        let i = 0
        let offset = 0
        let word = 0
        const len = byteArray.length
        const words = new Uint32Array(((len / 4) | 0) + (len % 4 === 0 ? 0 : 1))
        while (i < (len - (len % 4))) {
            words[offset++] = (byteArray[i++] << 24) | (byteArray[i++] << 16) | (byteArray[i++] << 8) | (byteArray[i++])
        }
        if (len % 4 !== 0) {
            word = byteArray[i++] << 24
            if (len % 4 > 1) {
                word = word | byteArray[i++] << 16
            }
            if (len % 4 > 2) {
                word = word | byteArray[i++] << 8
            }
            words[offset] = word
        }
        return {
            sigBytes: len,
            words
        }
    },
    // assumes wordArray is Big-Endian
    wordArrayToByteArray (wordArray) {
        const len = wordArray.words.length
        if (len === 0) {
            return new Array(0)
        }
        const byteArray = new Array(wordArray.words.length * 4)
        let offset = 0
        let word; let i
        for (i = 0; i < len; i++) {
            word = wordArray.words[i]
            byteArray[offset++] = word >> 24
            byteArray[offset++] = (word >> 16) & 0xff
            byteArray[offset++] = (word >> 8) & 0xff
            byteArray[offset++] = word & 0xff
        }
        return byteArray.slice(0, wordArray.sigBytes)
    },
    byteArrayToString (bytes, opt_startIndex, length) {
        if (length === 0) {
            return ''
        }
        let UintBytes
        if (opt_startIndex && length) {
            const index = this.checkBytesToIntInput(bytes, parseInt(length, 10), parseInt(opt_startIndex, 10))
            UintBytes = new Uint8Array(bytes.slice(index, index + length))
        } else {
            UintBytes = new Uint8Array(bytes)
        }
        const utf8decoder = new TextDecoder('utf-8', { fatal: true })
        try {
            return utf8decoder.decode(UintBytes)
        } catch (_error) {
            return ''
        }
    }
}
