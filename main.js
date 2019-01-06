/**
 * Oilfox adapter
 */

"use strict";

const utils = require('@iobroker/adapter-core');
const adapter = new utils.Adapter('oilfox');
const querystring = require('querystring');
const https = require('https');

adapter.on('message', function (obj) {
	adapter.log.debug("adapter.on-message: << MESSAGE >>");
});

adapter.on('ready', function () {
	adapter.log.debug("adapter.on-ready: << READY >>");

	if (adapter.config.email && adapter.config.password) {
		main();
	} else {
		adapter.log.warn('No E-Mail or Password set');
		adapter.stop();
	}
	
	
});

adapter.on('unload', function () {
	adapter.log.debug("adapter.on-unload: << UNLOAD >>");
});

adapter.on('stateChange', function (id, state) {
	adapter.log.debug("adapter.on-stateChange: << STATE-CHANGE >>");
});


function connectOilfox() {
	let post_data = JSON.stringify({
		'email': adapter.config.email,
		'password': adapter.config.password
	});

	let request_options = {
		host: 'api.oilfox.io',
		port: '443',
		path: '/v2/backoffice/session',
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Connection': 'Keep-Alive',
			'User-Agent': 'okhttp/3.2.0',
			'Content-Length': post_data.length,
			'Accept': '*/*'
		}
	};

	let tokenRequest = https.request(request_options, (tokenRequestResult) => {
		tokenRequestResult.setEncoding('utf8');
		let tokenData = "";
		tokenRequestResult.on('data', (chunk) => { adapter.log.debug("recieved chunk: " + chunk); tokenData += chunk; });
		tokenRequestResult.on('end', () => {
			adapter.log.debug("recieved data: " + tokenData);
			let tokenObject = JSON.parse(tokenData);
			request_options.headers['X-Auth-Token'] = tokenObject.token;
			request_options.path = '/v2/user/summary';
			request_options.method = 'GET';
			let summaryRequest = https.request(request_options, (summaryRequestResult) => {
				summaryRequestResult.setEncoding('utf8');
				let summaryData = "";
				summaryRequestResult.on('data', (chunk) => { adapter.log.debug("recieved chunk2: " + chunk); summaryData += chunk; });
				summaryRequestResult.on('end', () => {
					adapter.log.debug("recieved data 2: " + summaryData);
					let summaryObject = JSON.parse(summaryData);
					let promises = createStateObjectsFromResult(summaryObject);
					if (createStateObjects) {
						adapter.log.debug("create state objects from summary");
						Promise.all(promises).then(() => {
							adapter.log.debug("update states from summary");
							updateStatesFromResult(summaryObject);
						}).catch((err) => {
							adapter.log.error("error: " + err);
						});
					} else { 
						adapter.log.debug("update states from summary");
						updateStatesFromResult(summaryObject);
					}
					adapter.stop();
				});
			});
			summaryRequest.end();
		});
	});

	adapter.log.debug("send data: " + post_data);
	tokenRequest.write(post_data);
	tokenRequest.end();
}

function main() {
	adapter.log.debug("adapter.main: << MAIN >>");
	connectOilfox();
}

function createStateObjectsFromResult(summaryObject) {
	const promises = [];
	for (let p in summaryObject) {
		if (typeof summaryObject[p] !== 'object') {
			promises.push(adapter.setObjectNotExistsAsync('info.' + p, {
				type: 'state',
				common: {
					'name': p,
					'role': 'state',
					'type': typeof summaryObject[p],
					'write': false,
					'read': true
				},
				native: {}
			}));
		}
	}
	let i = 0;
	for (let p in summaryObject.devices) {
		for (let pp in summaryObject.devices[p]) {
			if (typeof summaryObject.devices[p][pp] !== 'object') {
				promises.push(adapter.setObjectNotExistsAsync('devices.' + i + '.' + pp, {
					type: 'state',
					common: {
						'name': 'device.' + pp,
						'role': 'state',
						'type': typeof summaryObject.devices[p][pp],
						'write': false,
						'read': true
					},
					native: {}
				}));
			}
		}

		for (let pp in summaryObject.devices[p].metering) {
			if (typeof summaryObject.devices[p].metering[pp] !== 'object') {
				promises.push(adapter.setObjectNotExistsAsync('devices.' + i + '.metering.' + pp, {
					type: 'state',
					common: {
						'name': 'device.metering.' + pp,
						'role': 'state',
						'type': typeof summaryObject.devices[p].metering[pp],
						'write': false,
						'read': true
					},
					native: {}
				}));
			}
		}
		i++;
	}
	return promises;
}

function updateStatesFromResult(summaryObject) {
	for (let p in summaryObject) {
		if (typeof summaryObject[p] !== 'object') {
			adapter.setState('info.' + p, summaryObject[p], true);
		}
	}
	let j = 0;
	for (let p in summaryObject.devices) {
		for (let pp in summaryObject.devices[p]) {
			if (typeof summaryObject.devices[p][pp] !== 'object') {
				adapter.setState('devices.' + j + '.' + pp, summaryObject.devices[p][pp], true);
			}
		}

		for (let pp in summaryObject.devices[p].metering) {
			if (typeof summaryObject.devices[p].metering[pp] !== 'object') {
				adapter.setState('devices.' + j + '.metering.' + pp, summaryObject.devices[p].metering[pp], true);
			}
		}
		j++;
	}
}
