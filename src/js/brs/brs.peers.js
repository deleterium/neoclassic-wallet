/**
 * @depends {brs.js}
 */

import { BRS } from '.'

import { reloadCurrentPage } from './brs'

import { sendRequest } from './brs.server'

import {
    formatVolume,
    dataLoaded
} from './brs.util'

export function pagesPeers () {
    sendRequest('getPeers+', {
        active: 'true'
    }, function (response) {
        if (response.peers && response.peers.length) {
            let peers = {}
            let nrPeers = 0

            for (let i = 0; i < response.peers.length; i++) {
                sendRequest('getPeer+', {
                    peer: response.peers[i]
                }, function (peer, input) {
                    if (BRS.currentPage !== 'peers') {
                        peers = {}
                        return
                    }

                    if (!peer.errorCode) {
                        peers[input.peer] = peer
                    }

                    nrPeers++

                    if (nrPeers === response.peers.length) {
                        let rows = ''
                        let uploaded = 0
                        let downloaded = 0
                        let connected = 0
                        let upToDate = 0
                        let activePeers = 0

                        for (let i = 0; i < nrPeers; i++) {
                            peer = peers[response.peers[i]]

                            if (!peer) {
                                continue
                            }

                            activePeers++
                            downloaded += peer.downloadedVolume
                            uploaded += peer.uploadedVolume
                            if (peer.state === 1) {
                                connected++
                            }

                            const versionToCompare = BRS.state.version

                            if (versionCompare(peer.version, versionToCompare)) {
                                upToDate++
                            }

                            rows += '<tr><td>' +
                                    (peer.state === 1 ? "<i class='fas fa-check-circle' style='color:#5cb85c' title='Connected'></i>" : "<i class='fas fa-times-circle' style='color:#f0ad4e' title='Disconnected'></i>") +
                                    '&nbsp;&nbsp;' +
                                    (peer.announcedAddress ? String(peer.announcedAddress).escapeHTML() : 'No name') +
                                    '</td><td>' +
                                    formatVolume(peer.downloadedVolume) +
                                    '</td><td>' +
                                    formatVolume(peer.uploadedVolume) +
                                    "</td><td><span class='label label-" +
                                    (versionCompare(peer.version, versionToCompare) ? 'success' : 'danger') +
                                    "'>" +
                                    (peer.application && peer.version ? String(peer.application).escapeHTML() + ' ' + String(peer.version).escapeHTML() : '?') +
                                    '</label></td><td>' +
                                    (peer.platform ? String(peer.platform).escapeHTML() : '?') +
                                    '</td></tr>'
                        }

                        $('#peers_uploaded_volume').html(formatVolume(uploaded)).removeClass('loading_dots')
                        $('#peers_downloaded_volume').html(formatVolume(downloaded)).removeClass('loading_dots')
                        $('#peers_connected').html(connected).removeClass('loading_dots')
                        $('#peers_up_to_date').html(upToDate + '/' + activePeers).removeClass('loading_dots')

                        dataLoaded(rows)
                    }
                })
            }
        } else {
            $('#peers_uploaded_volume, #peers_downloaded_volume, #peers_connected, #peers_up_to_date').html('0').removeClass('loading_dots')
            dataLoaded()
        }
    })
}

export function incomingPeers () {
    reloadCurrentPage()
}

class PreleaseTag {
    constructor (tag) {
        let priority
        switch (tag) {
        case 'dev':
            priority = 0
            break
        case 'alpha':
            priority = 1
            break
        case 'beta':
            priority = 2
            break
        case 'rc':
            priority = 3
            break
        case '':
            priority = 4
            break
        default:
            priority = 5
            break
        }
        this.priority = priority
    }
}

class Version {
    constructor (version) {
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

    isGreaterThan (otherVersion) {
        if (this.major > otherVersion.major) return true
        if (this.major < otherVersion.major) return false
        if (this.minor > otherVersion.minor) return true
        if (this.minor < otherVersion.minor) return false
        if (this.patch > otherVersion.patch) return true
        if (this.patch < otherVersion.patch) return false
        if (this.prereleaseTag.priority > otherVersion.prereleaseTag.priority) return true
        if (this.prereleaseTag.priority < otherVersion.prereleaseTag.priority) return false
        return this.prereleaseIteration > otherVersion.prereleaseIteration
    };

    isGreaterThanOrEqualTo (otherVersion) {
        if (this.isGreaterThan(otherVersion)) return true
        return this.equals(otherVersion)
    };

    equals (version) {
        if (this.major !== version.major) return false
        if (this.minor !== version.minor) return false
        if (this.patch !== version.patch) return false
        if (this.prereleaseIteration !== version.prereleaseIteration) return false
        return this.prereleaseTag.priority === version.prereleaseTag.priority
    };
}

function versionCompare (v1, v2) {
    if (v2 === undefined || v2 === null) {
        return -1
    } else if (v1 === undefined || v1 === null) {
        return -1
    }
    try {
        const version1 = new Version(v1)
        const version2 = new Version(v2)
        return version1.isGreaterThanOrEqualTo(version2)
    } catch (err) {
        return false
    }
}
