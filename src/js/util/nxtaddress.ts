/*
    NXT address class, extended version (with error guessing).

    Version: 1.0, license: Public Domain, coder: NxtChg (admin@nxtchg.com).
*/

export class NxtAddress {
    constructor (idOrRs) {
        this.codeword = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        this.gexp = [1, 2, 4, 8, 16, 5, 10, 20, 13, 26, 17, 7, 14, 28, 29, 31, 27, 19, 3, 6, 12, 24, 21, 15, 30, 25, 23, 11, 22, 9, 18, 1]
        this.glog = [0, 0, 1, 18, 2, 5, 19, 11, 3, 29, 6, 27, 20, 8, 12, 23, 4, 10, 30, 17, 7, 22, 28, 26, 21, 25, 9, 16, 13, 14, 24, 15]
        this.cwmap = [3, 2, 1, 0, 7, 6, 5, 4, 13, 14, 15, 16, 12, 8, 9, 10, 11]
        this.rsRegEx = /^(BURST-|S-|TS-)([0-9A-Z]{3,5}-[0-9A-Z]{3,5}-[0-9A-Z]{3,5}-[0-9A-Z]{4,6})?(?:-([0-9A-Z]+))?$/
        this.alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
        this.guess = new Set()
        idOrRs = String(idOrRs).trim().toUpperCase()
        if (idOrRs.match(/^\d{1,20}$/g)) {
            this.setFromId(idOrRs)
            return
        }
        this.setFromRS(idOrRs)
    }

    /** private */
    ginv (a) {
        return this.gexp[31 - this.glog[a]]
    }

    /** private */
    gmult (a, b) {
        if (a === 0 || b === 0) return 0
        const idx = (this.glog[a] + this.glog[b]) % 31
        return this.gexp[idx]
    }

    /** private */
    calcDiscrepancy (lambda, r, syndrome) {
        let discr = 0
        for (let i = 0; i < r; i++) {
            discr ^= this.gmult(lambda[i], syndrome[r - i])
        }
        return discr
    }

    /** private */
    calcSyndrome () {
        const syndrome = [0, 0, 0, 0, 0]
        for (let i = 1; i < 5; i++) {
            let t = 0
            for (let j = 0; j < 31; j++) {
                if (j > 12 && j < 27) continue
                let pos = j
                if (j > 26) pos -= 14
                t ^= this.gmult(this.codeword[pos], this.gexp[(i * j) % 31])
            }
            syndrome[i] = t
        }
        return syndrome
    }

    /** private */
    findErrors (lambda) {
        const errloc = []
        for (let i = 1; i <= 31; i++) {
            let sum = 0
            for (let j = 0; j < 5; j++) {
                sum ^= this.gmult(this.gexp[(j * i) % 31], lambda[j])
            }
            if (sum === 0) {
                const pos = 31 - i
                if (pos > 12 && pos < 27) {
                    return []
                }
                errloc[errloc.length] = pos
            }
        }
        return errloc
    }

    /** private */
    guessErrors (maxErrors) {
        let el = 0
        const b = [0, 0, 0, 0, 0]
        const t = []
        let deg_lambda = 0
        let lambda = [1, 0, 0, 0, 0] // error+erasure locator poly
        // Berlekamp-Massey algorithm to determine error+erasure locator polynomial
        const syndrome = this.calcSyndrome()
        for (let r = 0; r < 4; r++) {
            const discr = this.calcDiscrepancy(lambda, r + 1, syndrome) // Compute discrepancy at the r-th step in poly-form
            if (discr !== 0) {
                deg_lambda = 0
                for (let i = 0; i < 5; i++) {
                    t[i] = lambda[i] ^ this.gmult(discr, b[i])
                    if (t[i]) deg_lambda = i
                }
                if (2 * el <= r) {
                    el = r + 1 - el
                    for (let i = 0; i < 5; i++) {
                        b[i] = this.gmult(lambda[i], this.ginv(discr))
                    }
                }
                lambda = t.slice(0) // copy
            }
            b.unshift(0) // shift => mul by x
        }
        // Find roots of the locator polynomial.
        const errloc = this.findErrors(lambda)
        const errors = errloc.length
        if (errors < 1 || errors > maxErrors) {
            return false
        }
        if (deg_lambda !== errors) {
            // deg(lambda) unequal to number of roots => uncorrectable error
            return false
        }
        // Compute err+eras evaluator poly omega(x) = s(x)*lambda(x) (modulo x**(4)). Also find deg(omega).
        const omega = [0, 0, 0, 0, 0]
        for (let i = 0; i < 4; i++) {
            let t1 = 0
            for (let j = 0; j < i; j++) {
                t1 ^= this.gmult(syndrome[i + 1 - j], lambda[j])
            }
            omega[i] = t1
        }
        // Compute error values in poly-form.
        for (let r = 0; r < errors; r++) {
            let t2 = 0
            let pos = errloc[r]
            const root = 31 - pos
            for (let i = 0; i < 4; i++) {
                // evaluate Omega at alpha^(-i)
                t2 ^= this.gmult(omega[i], this.gexp[(root * i) % 31])
            }
            if (t2) {
                // evaluate Lambda' (derivative) at alpha^(-i); all odd powers disappear
                const denom = this.gmult(lambda[1], 1) ^ this.gmult(lambda[3], this.gexp[(root * 2) % 31])
                if (denom === 0) {
                    return false
                }
                if (pos > 12) pos -= 14
                this.codeword[pos] ^= this.gmult(t2, this.ginv(denom))
            }
        }
        return true
    }

    /** private */
    calculateParity () {
        const p = [0, 0, 0, 0]
        for (let i = 12; i >= 0; i--) {
            const fb = this.codeword[i] ^ p[3]
            p[3] = p[2] ^ this.gmult(30, fb)
            p[2] = p[1] ^ this.gmult(6, fb)
            p[1] = p[0] ^ this.gmult(9, fb)
            p[0] = this.gmult(17, fb)
        }
        return p
    }

    /** private */
    setInvalidCodeword () {
        // just sets codeword to an invalid value
        this.codeword = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    }

    /** private */
    setCodeword (clean) {
        for (let i = 0; i < clean.length; i++) {
            this.codeword[this.cwmap[i]] = clean[i]
        }
    }

    /** private */
    setFromId (acc) {
        const inp = []
        const out = []
        let pos = 0
        let len = acc.length
        if (len === 20 && acc.charAt(0) !== '1') {
            this.setInvalidCodeword()
            return
        }
        for (let i = 0; i < len; i++) {
            inp[i] = acc.charCodeAt(i) - '0'.charCodeAt(0)
        }
        let newlen
        do {
            // base 10 to base 32 conversion
            let divide = 0
            newlen = 0
            for (let i = 0; i < len; i++) {
                divide = divide * 10 + inp[i]
                if (divide >= 32) {
                    inp[newlen++] = divide >> 5
                    divide &= 31
                } else if (newlen > 0) {
                    inp[newlen++] = 0
                }
            }
            len = newlen
            out[pos++] = divide
        } while (newlen)
        for (let i = 0; i < 13; i++) {
            // copy to codeword in reverse, pad with 0's
            this.codeword[i] = (--pos >= 0 ? out[i] : 0)
        }
        const parity = this.calculateParity()
        this.codeword[13] = parity[0]
        this.codeword[14] = parity[1]
        this.codeword[15] = parity[2]
        this.codeword[16] = parity[3]
    }

    /** private */
    setFromRS (adr) {
        let len = 0
        const clean = []
        const rsParts = this.rsRegEx.exec(adr)
        if (rsParts !== null) {
            // remove prefix and public key
            adr = rsParts[2]
        }
        for (let i = 0; i < adr.length; i++) {
            const pos = this.alphabet.indexOf(adr[i])
            if (pos >= 0) {
                clean[len++] = pos
                if (len > 18) {
                    this.setInvalidCodeword()
                    return
                }
            }
        }
        switch (len) {
        case 16: // guess deletion
            for (let i = 16; i >= 0; i--) {
                for (let j = 0; j < 32; j++) {
                    const tempClean = clean.slice(0)
                    tempClean.splice(i, 0, j)
                    this.setCodeword(tempClean)
                    if (this.isOk()) {
                        this.guess.add(this.getAccountRS())
                        continue
                    }
                    if (this.guessErrors(1) && this.isOk()) {
                        this.guess.add(this.getAccountRS())
                    }
                }
            }
            this.setInvalidCodeword()
            return
        case 18: // guess insertion
            for (let i = 0; i < 18; i++) {
                const tempClean = clean.slice(0)
                tempClean.splice(i, 1)
                this.setCodeword(tempClean)
                if (this.isOk()) {
                    this.guess.add(this.getAccountRS())
                    continue
                }
                if (this.guessErrors(1) && this.isOk()) {
                    this.guess.add(this.getAccountRS())
                }
            }
            this.setInvalidCodeword()
            return
        case 17:
            this.setCodeword(clean)
            if (this.isOk()) {
                // Address is OK, so let the right codeword loaded
                return
            }
            if (this.guessErrors(2) && this.isOk()) {
                this.guess.add(this.getAccountRS())
            }
            this.setInvalidCodeword()
            return
        default:
            this.setInvalidCodeword()
        }
    }

    /** Returns true if the address is valid
     * or false if there is an error. Use 'getGuesses' to check if
     * the mistake was recovered.
     */
    isOk () {
        const parity = this.calculateParity()
        return this.codeword[13] === parity[0] &&
            this.codeword[14] === parity[1] &&
            this.codeword[15] === parity[2] &&
            this.codeword[16] === parity[3]
    }

    /** Returns the account in the Reed-Solomon format.
     * If prefix is undefined, no prefix is added.
     */
    getAccountRS (prefix) {
        if (!this.isOk()) {
            return ''
        }
        let out = ''
        if (prefix !== undefined) {
            out = prefix.replace('-', '') + '-'
        }
        for (let i = 0; i < 17; i++) {
            out += this.alphabet[this.codeword[this.cwmap[i]]]
            if ((i & 3) === 3 && i < 13) out += '-'
        }
        return out
    } // __________________________

    /** Returns the numeric ID of an account as string. If given account was
     * invalid, returns empty string */
    getAccountId () {
        if (!this.isOk()) {
            return ''
        }
        let out = ''
        const inp = []
        let len = 13
        for (let i = 0; i < 13; i++) {
            inp[i] = this.codeword[12 - i]
        }
        let newlen
        do {
            // base 32 to base 10 conversion
            let divide = 0
            newlen = 0
            for (let i = 0; i < len; i++) {
                divide = divide * 32 + inp[i]
                if (divide >= 10) {
                    inp[newlen++] = Math.floor(divide / 10)
                    divide %= 10
                } else if (newlen > 0) {
                    inp[newlen++] = 0
                }
            }
            len = newlen
            out += String.fromCharCode(divide + '0'.charCodeAt(0))
        } while (newlen)
        return out.split('').reverse().join('')
    }

    /** Get guessed results */
    getGuesses (prefix) {
        const resultArray = Array.from(this.guess)
        if (prefix === undefined) {
            return resultArray
        }
        prefix = prefix.replace('-', '')
        return resultArray.map(adr => prefix + '-' + adr)
    }

    /** Compares two strings and returns the diff formatted in HTML with underscore */
    formatGuess (s, org) {
        let d = ''
        const list = []
        s = s.toUpperCase()
        org = org.toUpperCase()
        for (let i = 0; i < s.length; i++) {
            let m = 0
            for (let j = 1; j < s.length; j++) {
                const pos = org.indexOf(s.substr(i, j))
                if (pos !== -1) {
                    if (Math.abs(pos - i) < 3) {
                        m = j
                    }
                    continue
                }
                break
            }
            if (m) {
                list[list.length] = {
                    s: i,
                    e: i + m
                }
                i += m - 1
            }
        }
        if (list.length === 0) {
            return s
        }
        for (let i = 0, j = 0; i < s.length; i++) {
            if (i >= list[j].e) {
                let start
                while (j < list.length - 1) {
                    start = list[j++].s
                    if (i < list[j].e || list[j].s >= start) {
                        break
                    }
                }
            }
            if (i >= list[j].s && i < list[j].e) {
                d += s.charAt(i)
            } else {
                d += '<u>' + s.charAt(i) + '</u>'
            }
        }
        return d
    }
}
