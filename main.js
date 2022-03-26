/**
 * Oilfox adapter
 */

"use strict";

const utils = require('@iobroker/adapter-core');
const querystring = require('querystring');
const https = require('https');
const adapterName = require('./package.json').name.split('.').pop();

let adapter;
function startAdapter(options) {
	options = options || {};
	Object.assign(options, {
		name: adapterName,
		ready: function () {
			try {
				adapter.log.debug("adapter.on-ready: << READY >>");

				if (adapter.config.email && adapter.config.password) {
					main();
				} else {
					adapter.log.warn('No E-Mail or Password set');
					adapter.stop();
				}
			} catch (err) {
				adapter.log.error(err);
				adapter.stop();
			}
		}
	});
	adapter = new utils.Adapter(options);

	return adapter;
};

function connectOilfox() {
	let post_data = JSON.stringify({
		'email': adapter.config.email,
		'password': adapter.config.password
	});

	let request_options = {
		host: 'api.oilfox.io',
		port: '443',
		path: '/customer-api/v1/login',
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Connection': 'Keep-Alive',
			'User-Agent': 'okhttp/3.2.0',
			'Content-Length': post_data.length,
			'Accept': '*/*',
			'User-Agent': 'ioBroker.oilfox'
		}
	};

	let tokenRequest = https.request(request_options, (tokenRequestResult) => {
		tokenRequestResult.setEncoding('utf8');
		let tokenData = "";
		tokenRequestResult.on('data', (chunk) => { adapter.log.debug("recieved chunk: " + chunk); tokenData += chunk; });
		tokenRequestResult.on('end', () => {
			adapter.log.debug("recieved data: " + tokenData);
			let tokenObject = JSON.parse(tokenData);
			request_options.headers['Authorization'] = 'Bearer ' + tokenObject.access_token;
			request_options.path = '/customer-api/v1/device';
			request_options.method = 'GET';
			let summaryRequest = https.request(request_options, (summaryRequestResult) => {
				summaryRequestResult.setEncoding('utf8');
				let summaryData = "";
				summaryRequestResult.on('data', (chunk) => { adapter.log.debug("recieved chunk2: " + chunk); summaryData += chunk; });
				summaryRequestResult.on('end', () => {
					adapter.log.debug("recieved data 2: " + summaryData);
					let summaryObject = JSON.parse(summaryData);
					let promises = createStateObjectsFromResult(summaryObject);

					adapter.log.debug("create state objects from summary");
					Promise.all(promises).then(async () => {
						adapter.log.debug("update states from summary");
						await updateStatesFromResult(summaryObject);
					}).catch((err) => {
						adapter.log.error("error: " + err);
					});

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
	for (let p in summaryObject.items) {
		for (let pp in summaryObject.items[p]) {
			if (typeof summaryObject.items[p][pp] !== 'object') {
				promises.push(adapter.setObjectNotExistsAsync('items.' + i + '.' + pp, {
					type: 'state',
					common: {
						'name': 'device.' + pp,
						'role': 'state',
						'type': typeof summaryObject.items[p][pp],
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

async function updateStatesFromResult(summaryObject) {
	try {
		for (let p in summaryObject) {
			if (typeof summaryObject[p] !== 'object') {
				adapter.setState('info.' + p, summaryObject[p], true);
			}
		}

		
		for (let p in summaryObject.items) {
			let state = null;
			let j = 0;
			while (j < summaryObject.items.length) {
				state = await adapter.getStateAsync('items.' + j + '.id');
				if (state != null && (!state.val || state.val == summaryObject.items[p].id)) {
					break;
				}
				else if (state == null) {
					state = true; //first run
					break;
				}
				
				state = null;
				j++;
			}
			if (state) {
				for (let pp in summaryObject.items[p]) {
					if (typeof summaryObject.items[p][pp] !== 'object') {
						adapter.setState('items.' + j + '.' + pp, summaryObject.items[p][pp], true);
					}
				}
			}
		}
	}
	catch (err) {
		adapter.log.error(err);
	}
}

// If started as allInOne/compact mode => return function to create instance
if (module && module.parent) {
	module.exports = startAdapter;
} else {
	// or start the instance directly
	startAdapter();
}
