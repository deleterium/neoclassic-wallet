// A type guard that tells TypeScript the shape is the alias linked
export function isAliasSubscription<T>(res: T): res is T & { alias: string; aliasName: string; tld: string; tldName: string } {
    // @ts-expect-error: check only alias to know if other properties are present!
    return res.alias !== undefined
}
