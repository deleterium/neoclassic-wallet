import { BRS } from '..'

import { reloadCurrentPage } from '../core/navigation'

import { sendRequestA } from '../core/send_request'

import { formatVolume } from '../core/numbers'

import { dataLoaded } from '../core/util'

import { GetPeerResponse, GetPeersResponse } from '../typings'

export async function pagesPeers() {
    const response: GetPeersResponse = await sendRequestA('getPeers+', {
        active: 'true',
    })

    if (!response.peers || response.peers.length === 0) {
        $('#peers_uploaded_volume, #peers_downloaded_volume, #peers_connected, #peers_up_to_date').html('0').removeClass('loading_dots')
        dataLoaded()
        return
    }

    const peers: Record<string, GetPeerResponse> = {}
    let nrPeers = 0

    let rows = ''
    for (const peerIP of response.peers) {
        rows += `
            <tr id='peer-${peerIP.replace(/\./g, '-')}'>
              <td>${peerIP}</td>
              <td>${BRS.pendingTransactionHTML}</td>
              <td>${BRS.pendingTransactionHTML}</td>
              <td>${BRS.pendingTransactionHTML}</td>
              <td>${BRS.pendingTransactionHTML}</td>
            </tr>`

        sendRequestA('getPeer+', {
            peer: peerIP,
        }).then((response2: GetPeerResponse) => {
            if (BRS.currentPage !== 'peers') {
                return
            }

            nrPeers++
            if (response2.errorCode) {
                if (nrPeers === response.peers.length) {
                    peersFinished(peers)
                }
                return
            }

            peers[peerIP] = response2

            // Append row dynamically as each peer is received
            const peerData = response2
            const versionToCompare = BRS.blockchainStatus?.version
            const isUpToDate = versionCompare(peerData.version, versionToCompare)
            const isConnected = peerData.state === 1

            const row = `
                <tr>
                  <td>
                    ${isConnected ? "<i class='fas fa-check-circle' style='color:#5cb85c' title='Connected'></i>" : "<i class='fas fa-times-circle' style='color:#f0ad4e' title='Disconnected'></i>"}
                    &nbsp;&nbsp;
                    ${peerData.announcedAddress ? String(peerData.announcedAddress).escapeHTML() : 'No name'}
                  </td>
                  <td>${formatVolume(peerData.downloadedVolume)}</td>
                  <td>${formatVolume(peerData.uploadedVolume)}</td>
                  <td><span class='label label-${isUpToDate ? 'success' : 'danger'}'>
                    ${peerData.application && peerData.version ? String(peerData.application).escapeHTML() + ' ' + String(peerData.version).escapeHTML() : '?'}
                  </span></td>
                  <td>${peerData.platform ? String(peerData.platform).escapeHTML() : '?'}</td>
                </tr>`
            $('#peer-' + peerIP.replace(/\./g, '-')).replaceWith(row)

            if (nrPeers === response.peers.length) {
                peersFinished(peers)
            }
        })
    }
    dataLoaded(rows)
}

function peersFinished(peers: Record<string, GetPeerResponse>) {
    let uploaded = 0
    let downloaded = 0
    let connected = 0
    let upToDate = 0
    let activePeers = 0

    for (const ip in peers) {
        const peer = peers[ip]

        activePeers++
        downloaded += peer.downloadedVolume
        uploaded += peer.uploadedVolume
        if (peer.state === 1) {
            connected++
        }

        const versionToCompare = BRS.blockchainStatus?.version

        if (versionCompare(peer.version, versionToCompare)) {
            upToDate++
        }
    }

    $('#peers_uploaded_volume').text(formatVolume(uploaded)).removeClass('loading_dots')
    $('#peers_downloaded_volume').text(formatVolume(downloaded)).removeClass('loading_dots')
    $('#peers_connected').text(connected).removeClass('loading_dots')
    $('#peers_up_to_date')
        .text(upToDate + '/' + activePeers)
        .removeClass('loading_dots')
}

export function incomingPeers() {
    reloadCurrentPage()
}

class PreleaseTag {
    priority: number
    constructor(tag: string) {
        switch (tag) {
            case 'dev':
                this.priority = 0
                break
            case 'alpha':
                this.priority = 1
                break
            case 'beta':
                this.priority = 2
                break
            case 'rc':
                this.priority = 3
                break
            case '':
                this.priority = 4
                break
            default:
                this.priority = 5
                break
        }
    }
}

class Version {
    major: number
    minor: number
    patch: number
    prereleaseTag: PreleaseTag
    prereleaseIteration: number
    constructor(version: string) {
        version = version.replace('-', '.').toLowerCase()
        if (version.startsWith('v')) version = version.substring(1)
        const tokens = version.split('.')
        this.major = parseInt(tokens[0])
        this.minor = parseInt(tokens[1])
        this.patch = parseInt(tokens[2])
        if (tokens.length > 3) {
            const prereleaseTagAndIteration = tokens[3].split(/([a-z]+)([0-9]+)/).filter(function (s) {
                return s !== ''
            })
            this.prereleaseTag = new PreleaseTag(prereleaseTagAndIteration[0])
            this.prereleaseIteration = prereleaseTagAndIteration.length === 2 ? parseInt(prereleaseTagAndIteration[1]) : -1
        } else {
            this.prereleaseTag = new PreleaseTag('')
            this.prereleaseIteration = 0
        }
    }

    isGreaterThan(otherVersion: Version) {
        if (this.major > otherVersion.major) return true
        if (this.major < otherVersion.major) return false
        if (this.minor > otherVersion.minor) return true
        if (this.minor < otherVersion.minor) return false
        if (this.patch > otherVersion.patch) return true
        if (this.patch < otherVersion.patch) return false
        if (this.prereleaseTag.priority > otherVersion.prereleaseTag.priority) return true
        if (this.prereleaseTag.priority < otherVersion.prereleaseTag.priority) return false
        return this.prereleaseIteration > otherVersion.prereleaseIteration
    }

    isGreaterThanOrEqualTo(otherVersion: Version) {
        if (this.isGreaterThan(otherVersion)) return true
        return this.equals(otherVersion)
    }

    equals(version: Version) {
        if (this.major !== version.major) return false
        if (this.minor !== version.minor) return false
        if (this.patch !== version.patch) return false
        if (this.prereleaseIteration !== version.prereleaseIteration) return false
        return this.prereleaseTag.priority === version.prereleaseTag.priority
    }
}

function versionCompare(v1?: string, v2?: string) {
    if (v2 === undefined || v2 === null) {
        return -1
    } else if (v1 === undefined || v1 === null) {
        return -1
    }
    try {
        const version1 = new Version(v1)
        const version2 = new Version(v2)
        return version1.isGreaterThanOrEqualTo(version2)
    } catch {
        return false
    }
}
