/* ------------------------------------------------------------------
* node-beacon-scanner - parser.js
*
* Copyright (c) 2017-2018, Futomi Hatano, All rights reserved.
* Released under the MIT license
* Date: 2018-06-24
* ---------------------------------------------------------------- */
'use strict';

const mIbeacon = require('./parser-ibeacon.js');
const mEstimote = require('./parser-estimote.js');
const mEddystone = require('./parser-eddystone.js');

/* ------------------------------------------------------------------
* Constructor: EstimoteAdvertising()
* ---------------------------------------------------------------- */
const BeaconParser = function() {
	// Private properties
	this._ESTIMOTE_TELEMETRY_SERVICE_UUID = 'fe9a';
	this._ESTIMOTE_COMPANY_ID = 0x015d;
	this._EDDYSTONE_SERVICE_UUID = 'feaa';
        this._MINEW_SERVICE_UUID = 'ffe1';
};

/* ------------------------------------------------------------------
* Method: parse(peripheral)
* - peripheral: `Peripheral` object of the noble
* ---------------------------------------------------------------- */
BeaconParser.prototype.parse = function(peripheral) {
	let ad = peripheral.advertisement;
	let manu = ad.manufacturerData;
	let res = {
		id                : peripheral.id,
		address           : peripheral.address,
		localName         : ad.localName || null,
		txPowerLevel      : ad.txPowerLevel || null,
		rssi              : peripheral.rssi
	};

	let beacon_type = this._detectBeaconType(peripheral);
	res['beaconType'] = beacon_type;
	let parsed = null;

	// iBeacon
	if(beacon_type === 'iBeacon') {
		parsed = mIbeacon.parse(peripheral);
	// Eddystone
	} else if(beacon_type === 'eddystoneUid') {
		parsed = mEddystone.parseUid(peripheral);
	} else if(beacon_type === 'eddystoneUrl') {
		parsed = mEddystone.parseUrl(peripheral);
	} else if(beacon_type === 'eddystoneTlm') {
		parsed = mEddystone.parseTlm(peripheral);
	} else if(beacon_type === 'eddystoneEid') {
		parsed = mEddystone.parseEid(peripheral);
	// Estimote
	} else if(beacon_type === 'estimoteTelemetry') {
		parsed = mEstimote.parseTelemetry(peripheral);
	} else if(beacon_type === 'estimoteNearable') {
		parsed = mEstimote.parseNearable(peripheral);
	} else if(beacon_type === 'minewSensor') {
		parsed = mMinew.parse(peripheral);
	}

	if(parsed) {
		res[beacon_type] = parsed;
		//Minew sensors don't populate the address field, it instead sends it via the service advertisement. He we copy it over to the address field.
		if (beacon_type === 'minewSensors' && !res.address) {
			res.address = parsed.macAddress;
		}
		return res;
	} else {
		return null;
	}
};

BeaconParser.prototype._detectBeaconType = function(peripheral) {
	let ad = peripheral.advertisement;
	let manu = ad.manufacturerData;
	// Eddiystone
	let eddystone_service = ad.serviceData && ad.serviceData.find((el) => {
		return el.uuid === this._EDDYSTONE_SERVICE_UUID;
	});
	if(eddystone_service  && eddystone_service.data) {
		// https://github.com/google/eddystone/blob/master/protocol-specification.md
		let frame_type = eddystone_service.data.readUInt8(0) >>> 4;
		if(frame_type === 0b0000) {
			return 'eddystoneUid';
		} else if(frame_type === 0b0001) {
			return 'eddystoneUrl';
		} else if(frame_type === 0b0010) {
			return 'eddystoneTlm';
		} else if(frame_type === 0b0011) {
			return 'eddystoneEid';
		}
	}
        // Minew Sensors
	let minew_service = ad.serviceData && ad.serviceData.find((el) => {
		return el.uuid === this._MINEW_SERVICE_UUID;
	});
	if (minew_service) {
		return 'minewSensor';
	}
	// iBeacon
	if(manu && manu.length >= 4 && manu.readUInt32BE(0) === 0x4c000215) {
		return 'iBeacon';
	}
	// Estimote Telemetry
	let telemetry_service = ad.serviceData && ad.serviceData.find((el) => {
		return el.uuid === this._ESTIMOTE_TELEMETRY_SERVICE_UUID;
	});
	if(telemetry_service  && telemetry_service.data) {
		return 'estimoteTelemetry';
	}
	// Estimote Nearable
	if(manu && manu.length >= 2 && manu.readUInt16LE(0) === this._ESTIMOTE_COMPANY_ID) {
		return 'estimoteNearable';
	}
	// Unknown
	return '';
};

module.exports = new BeaconParser();
