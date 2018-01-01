'use strict'

const EventEmitter = require('events').EventEmitter
const inherits = require('inherits')
const bencode = require('bencode')
const debug = require('debug')('wt-slimweb-helper')

// TODO: maybe destroy peer connections who do
// not support the slimweb handshake protocol?

/**
 * Returns a bittorrent extension
 * @param {String} opts.clientVer
 * @param {String} opts.torrentType
 * @param {String} opts.payload
 * @return {BitTorrent Extension}
 */
var wt_slimweb_extension = function (opts) {
  if (!opts) {
    opts = {};
  }

  inherits(wt_slimweb, EventEmitter);

  function wt_slimweb (wire) {
    EventEmitter.call(this);

    debug('wt_slimweb instantiated');

    this._wire = wire;

    this.clientVer = opts.clientVer;
    this.torrentType = opts.torrentType;
    this.payload = opts.payload || "";

    if (!this.clientVer) {
      throw new Error('Must instantiate wt_slimweb with a clientVer');
    }
    if (!this.torrentType) {
      throw new Error('Must instantiate wt_slimweb with torrentType');
    }

    // Peer fields will be set once the extended handshake is received
    this.peerClientVer = null;
    this.peerTorrentType = null;
    this.peerPayload = null;

    this.peerId = null;
    this.amForceChoking = false;

    // Add fields to extended handshake, which will be sent to peer
    this._wire.extendedHandshake.slmweb_client_ver = this.clientVer;
    this._wire.extendedHandshake.slmweb_torrent_type = this.torrentType;
    this._wire.extendedHandshake.slmweb_payload = this.payload;

    debug('Extended handshake to send: ', this._wire.extendedHandshake);
  }

  wt_slimweb.prototype.name = 'wt_slimweb';

  wt_slimweb.prototype.onHandshake = function (infoHash, peerId, extensions) {
    this.peerId = peerId;
  }

  wt_slimweb.prototype.onExtendedHandshake = function (handshake) {
    if (!handshake.m || !handshake.m.wt_slimweb) {
      return this.emit('slmweb_warning', new Error('Peer does not support wt_slimweb'));
    }

    var missingComponents = true;
    if (handshake.slmweb_client_ver) {
      this.peerClientVer = handshake.slmweb_client_ver.toString('utf8');
      missingComponents = false;
    }
    
    if (handshake.slmweb_torrent_type) {
      this.peerTorrentType = handshake.slmweb_torrent_type.toString('utf8');
      missingComponents = false;
    }

    if (handshake.slmweb_payload) {
      this.peerPayload = handshake.slmweb_payload.toString('utf8');
      missingComponents = false;
    }

    if (missingComponents) {
      debug('Peer: '+ this.peerId +' sent incomplete');
      return this.emit('slmweb_warning', new Error('Peer sent incomplete'));
    }

    this.emit('slmweb_handshake', {
      clientVer: this.peerClientVer,
      torrentType: this.peerTorrentType,
      payload: this.peerPayload
    });
  }

  wt_slimweb.prototype.forceChoke = function () {
    this.amForceChoking = true;
    this._wire.choke();
  }

  wt_slimweb.prototype.unchoke = function () {
    this.amForceChoking = false;
  }

  return wt_slimweb;
};

module.exports = wt_slimweb_extension;
