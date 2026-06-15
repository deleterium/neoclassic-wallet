
import {
    ByteArray,
    HexString,
    HexChar
} from "../typings"

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
    hexStringToByteArray (str: HexString) : number[] {
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
    byteArrayToBigInt64 (bytes: ByteArray, opt_startIndex?: number) : bigint {
        const index = this.checkBytesToIntInput(bytes, 8, opt_startIndex)
        let value = 0n
        for (let i = 7; i >= 0; i--) {
            value = (value << 8n) | BigInt(bytes[index + i]);
        }
        return value
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
        } catch {
            return ''
        }
    }
}
