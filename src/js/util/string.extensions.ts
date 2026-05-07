
declare global {
    interface String {
		escapeHTML(): string
		unescapeHTML(): string
		nl2br(): string
		capitalize(): string
    }
}

String.prototype.escapeHTML = function() {
	return this.replace(/[&<>"'\/]/g, function (match) {
		return {
			'&': '&amp;',
			'<': '&lt;',
			'>': '&gt;',
			'"': '&quot;',
			"'": '&#39;',
			'/': '&#x2F;'
		}[match]
	});
}

String.prototype.unescapeHTML = function() {
	return this.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>').replace('&quot;', '"').replace('&#39;', "'").replace('&#x2F;', '/')
}

String.prototype.nl2br = function() {
	return this.replace(/([^>\r\n]?)(\r\n|\n\r|\r|\n)/g, '$1<br />$2')
}

String.prototype.capitalize = function() {
	return this.charAt(0).toUpperCase() + this.slice(1)
}

export {}
