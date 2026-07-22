declare global {
    interface String {
        escapeHTML(): string
        unescapeHTML(): string
        nl2br(): string
        capitalize(): string
    }
}

String.prototype.escapeHTML = function () {
    return this.replace(/[&<>"'\/]/g, function (match) {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
            '/': '&#x2F;',
        }[match] as string
    })
}

String.prototype.unescapeHTML = function () {
    return this.replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#x2F;/g, '/')
}

String.prototype.nl2br = function () {
    return this.replace(/([^>\r\n]?)(\r\n|\n\r|\r|\n)/g, '$1<br />$2')
}

String.prototype.capitalize = function () {
    return this.charAt(0).toUpperCase() + this.slice(1)
}

export {}
