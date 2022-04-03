/**
 * Oilfox adapter
 */

'use strict';

const utils = require('@iobroker/adapter-core');
const https = require('https');
const adapterName = require('./package.json').name.split('.').pop();

let adapter;
function startAdapter(options) {
	options = options || {};
	Object.assign(options, {
		name: adapterName,
		ready: () => {
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
}

function connectOilfox() {
	let postData = JSON.stringify({
		email: adapter.config.email,
		password: adapter.config.password
	});

	let request_options = {
		host: 'api.oilfox.io',
		port: '443',
		path: '/customer-api/v1/login',
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Connection': 'Keep-Alive',
			//'User-Agent': 'okhttp/3.2.0',
			'Content-Length': postData.length,
			'Accept': '*/*',
			'User-Agent': 'ioBroker.oilfox'
		}
	};

	let tokenRequest = https.request(request_options, tokenRequestResult => {
		tokenRequestResult.setEncoding('utf8');
		let tokenData = '';

		tokenRequestResult.on('data', chunk => {
			adapter.log.debug(`received chunk: ${chunk}`);
			tokenData += chunk;
		});

		tokenRequestResult.on('end', () => {
			adapter.log.debug(`received data: ${tokenData}`);
			let tokenObject = JSON.parse(tokenData);
			request_options.headers['Authorization'] = `Bearer ${tokenObject.access_token}`;
			request_options.path = '/customer-api/v1/device';
			request_options.method = 'GET';
			let summaryRequest = https.request(request_options, (summaryRequestResult) => {
				summaryRequestResult.setEncoding('utf8');
				let summaryData = '';

				summaryRequestResult.on('data', chunk => {
					adapter.log.debug(`received chunk2: ${chunk}`);
					summaryData += chunk;
				});

				summaryRequestResult.on('end', async () => {
					adapter.log.debug(`received data 2: ${summaryData}`);
					let summaryObject = JSON.parse(summaryData);
					try {
						await createStateObjectsFromResult(summaryObject);

						adapter.log.debug('create state objects from summary');

						adapter.log.debug('update states from summary');
						await updateStatesFromResult(summaryObject);
					} catch (err) {
						adapter.log.error(`error: ${err}`);
					}

					adapter.stop();
				});
			});

			summaryRequest.end();
		});
	});

	adapter.log.debug(`send data: ${postData}`);
	tokenRequest.write(postData);
	tokenRequest.end();
}

function main() {
	adapter.log.debug('adapter.main: << MAIN >>');
	connectOilfox();
}

async function createStateObjectsFromResult(summaryObject) {
	for (let p in summaryObject) {
		if (typeof summaryObject[p] !== 'object') {
			await adapter.setObjectNotExistsAsync('info.' + p, {
				type: 'state',
				common: {
					'name': p,
					'role': 'state',
					'type': typeof summaryObject[p],
					'write': false,
					'read': true
				},
				native: {}
			});
		}
	}

	let i = 0;
	for (let p in summaryObject.items) {
		for (let pp in summaryObject.items[p]) {
			if (typeof summaryObject.items[p][pp] !== 'object') {
				await adapter.setObjectNotExistsAsync(`items.${i}.${pp}`, {
					type: 'state',
					common: {
						'name': 'device.' + pp,
						'role': 'state',
						'type': typeof summaryObject.items[p][pp],
						'write': false,
						'read': true
					},
					native: {}
				});
			}
		}

		i++;
	}
}

async function updateStatesFromResult(summaryObject) {
	try {
		for (let p in summaryObject) {
			if (typeof summaryObject[p] !== 'object') {
				await adapter.setStateAsync('info.' + p, summaryObject[p], true);
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
						await adapter.setStateAsync(`items.${p}.${pp}`, summaryObject.items[p][pp], true);
					}
				}
			}
		}
	} catch (err) {
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
