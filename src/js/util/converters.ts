
import { ByteArray, HexString, HexChar, WordArray } from "../typings"

type BigInteger = {
    t: number
    s: number
    add: (a: BigInteger) => BigInteger
    subtract: (a: BigInteger) => BigInteger
    multiply: (a: BigInteger) => BigInteger
    divide: (a: BigInteger) => BigInteger
    mod: (a: BigInteger) => BigInteger
    modPowInt: (e: number, m: BigInteger) => BigInteger
    modInverse: (m: BigInteger) => BigInteger
    pow: (e: BigInteger) => BigInteger
    gcd: (a: BigInteger) => BigInteger
    isProbablePrime: (t?: number) => boolean
    bitLength: () => number
    getLowestSetBit: () => number
    bitCount: () => number
    testBit: (n: number) => boolean
    setBit: (n: number) => BigInteger
    clearBit: (n: number) => BigInteger
    flipBit: (n: number) => BigInteger
    shiftLeft: (n: number) => BigInteger
    shiftRight: (n: number) => BigInteger
    and: (a: BigInteger) => BigInteger
    or: (a: BigInteger) => BigInteger
    xor: (a: BigInteger) => BigInteger
    andNot: (a: BigInteger) => BigInteger
    not: () => BigInteger
    equals: (a: BigInteger) => boolean
    min: (a: BigInteger) => BigInteger
    max: (a: BigInteger) => BigInteger
    clone: () => BigInteger
    intValue: () => number
    byteValue: () => number
    shortValue: () => number
    signum: () => number
    toByteArray: () => number[]
    square: () => BigInteger
    constructor: (a: any, b?: number, c?: any) => void
    ZERO: BigInteger
    ONE: BigInteger
}


export default {
    charToNibble: {
        '0': 0,
        '1': 1,
        '2': 2,
        '3': 3,
        '4': 4,
        '5': 5,
        '6': 6,
        '7': 7,
        '8': 8,
        '9': 9,
        'a': 10,
        'A': 10,
        'b': 11,
        'B': 11,
        'c': 12,
        'C': 12,
        'd': 13,
        'D': 13,
        'e': 14,
        'E': 14,
        'f': 15,
        'F': 15
    },
    nibbleToChar: [
        '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'
    ],
    byteArrayToHexString (bytes: ByteArray) : HexString {
        let str = ''
        for (let i = 0; i < bytes.length; ++i) {
            if (bytes[i] < 0) {
                bytes[i] += 256
            }
            str += this.nibbleToChar[bytes[i] >> 4] + this.nibbleToChar[bytes[i] & 0x0F]
        }
        return str
    },
    stringToByteArray (str: string) : ByteArray {
        const encoder = new TextEncoder()
        return Array.from(encoder.encode(str))
    },
    hexStringToByteArray (str: HexString) : ByteArray {
        const bytes : ByteArray = []
        let i = 0
        if (str.length % 2 !== 0) {
            bytes.push(this.charToNibble[str.charAt(0) as HexChar])
            ++i
        }
        for (; i < str.length - 1; i += 2) {
            bytes.push((this.charToNibble[str.charAt(i) as HexChar] << 4) + this.charToNibble[str.charAt(i + 1) as HexChar])
        }
        return bytes
    },
    stringToHexString (str: string) : HexString {
        return this.byteArrayToHexString(this.stringToByteArray(str))
    },
    hexStringToString (hex: HexString) : string {
        return this.byteArrayToString(this.hexStringToByteArray(hex))
    },
    checkBytesToIntInput (bytes: ByteArray, numBytes: number, opt_startIndex?: number) : number {
        const startIndex = opt_startIndex || 0
        if (startIndex < 0) {
            throw new Error('Start index should not be negative')
        }

        if (bytes.length < startIndex + numBytes) {
            throw new Error('Need at least ' + (numBytes) + ' bytes to convert to an integer')
        }
        return startIndex
    },
    byteArrayToSignedShort (bytes: ByteArray, opt_startIndex?: number) : number {
        const index = this.checkBytesToIntInput(bytes, 2, opt_startIndex)
        let value = bytes[index]
        value += bytes[index + 1] << 8
        return value
    },
    byteArrayToSignedInt32 (bytes: ByteArray, opt_startIndex?: number) : number {
        const index = this.checkBytesToIntInput(bytes, 4, opt_startIndex)
        let value = bytes[index]
        value += bytes[index + 1] << 8
        value += bytes[index + 2] << 16
        value += bytes[index + 3] << 24
        return value
    },
    byteArrayToBigInteger (bytes: ByteArray, opt_startIndex?: number) : BigInteger {
        const index = this.checkBytesToIntInput(bytes, 8, opt_startIndex)
        let value = new BigInteger('0', 10)
        let temp1: BigInteger; let temp2: BigInteger
        for (let i = 7; i >= 0; i--) {
            temp1 = value.multiply(new BigInteger('256', 10))
            temp2 = temp1.add(new BigInteger(bytes[index + i].toString(10), 10))
            value = temp2
        }
        return value
    },
    // create a wordArray that is Big-Endian
    byteArrayToWordArray (byteArray: ByteArray) : WordArray {
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
    wordArrayToByteArray (wordArray: WordArray) : ByteArray{
        const len = wordArray.words.length
        if (len === 0) {
            return new Array(0)
        }
        const byteArray = new Array(wordArray.words.length * 4)
        let offset = 0
        let word: number; let i: number
        for (i = 0; i < len; i++) {
            word = wordArray.words[i]
            byteArray[offset++] = word >> 24
            byteArray[offset++] = (word >> 16) & 0xff
            byteArray[offset++] = (word >> 8) & 0xff
            byteArray[offset++] = word & 0xff
        }
        return byteArray.slice(0, wordArray.sigBytes)
    },
    byteArrayToString (bytes: ByteArray, opt_startIndex?: number, length?: number) : string {
        if (length === 0) {
            return ''
        }
        let UintBytes: Uint8Array
        if (opt_startIndex && length) {
            const index = this.checkBytesToIntInput(bytes, length, opt_startIndex)
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
