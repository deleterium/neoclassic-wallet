import { BRS } from '..'

export function findTLDNameByTLDId(id: string) {
    for (const tldName in BRS.tlds) {
        if (BRS.tlds[tldName] === id) {
            return tldName
        }
    }
    return id
}
