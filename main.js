/**
 * Oilfox adapter
 */

"use strict";

const utils       = require('@iobroker/adapter-core');
const adapter     = new utils.Adapter('oilfox');
const querystring = require('querystring');
const https        = require('https');

let pollInterval;
let pollTimer;

adapter.on('message', function (obj) {
    adapter.log.debug("adapter.on-message: << MESSAGE >>");
});

adapter.on('ready', function () {
    adapter.log.debug("adapter.on-ready: << READY >>");
	
	if (adapter.config.email && adapter.config.password) {
        pollInterval = adapter.config.pollInterval || 60000;
        main();
    } else adapter.log.warn('No E-Mail or Password set');
});

adapter.on('unload', function () {
    adapter.log.debug("adapter.on-unload: << UNLOAD >>");
	
	if (pollTimer)
		clearTimeout(pollTimer);
});

adapter.on('stateChange', function (id, state) {
	adapter.log.debug("adapter.on-stateChange: << STATE-CHANGE >>");
});


function connectOilfox() {
	let post_data = JSON.stringify({
      'email' : adapter.config.email,
      'password': adapter.config.password
    });
	
	let post_options = {
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

  let post_req = https.request(post_options, function(res) {
      res.setEncoding('utf8');
      res.on('data', function (chunk) {
          adapter.log.debug("recieved data: " + chunk);
		  let resData = JSON.parse(chunk);
		  post_options.headers['X-Auth-Token'] = resData.token;
		  post_options.path = '/v2/user/summary';
		  post_options.method = 'GET';
		  let post_req2 = https.request(post_options, function(res2) {
		    res2.setEncoding('utf8');
			res2.on('data', function (chunk2) {
				 adapter.log.debug("recieved data 2: " + chunk2);
				 let result = JSON.parse(chunk2);
				 const promises = [];

				for (let p in result)
				{
					if (typeof result[p] !== 'object')
					{
						promises.push(adapter.setObjectNotExistsAsync('info.' + p, {
							type: 'state',
							common: {
								'name': 'Display content 0',
								'role': 'info.display',
								'type': 'string',
								'write': false,
								'read': true
							},
							native: {}
						}));
					}
				}
				let i = 0;
				for (let p in result.devices[i])
				{
					if (typeof result.devices[i][p] !== 'object')
					{
						promises.push(adapter.setObjectNotExistsAsync('devices.' + i + '.' + p, {
							type: 'state',
							common: {
								'name': 'Display content 0',
								'role': 'info.display',
								'type': 'string',
								'write': false,
								'read': true
							},
							native: {}
						}));
					}
					
					for (let pp in result.devices[i].metering)
					{
						if (typeof result.devices[i].metering[pp] !== 'object')
						{
							promises.push(adapter.setObjectNotExistsAsync('devices.' + i + '.metering.' + pp, {
								type: 'state',
								common: {
									'name': 'Display content 0',
									'role': 'info.display',
									'type': 'string',
									'write': false,
									'read': true
								},
								native: {}
							}));
						}
					}
					i++;
				}
				
				Promise.all(promises).then(() => {
					for (let p in result)
					{
						if (typeof result[p] !== 'object')
						{
							adapter.setState('info.' + p, result[p], true);
						}
					}
					let j = 0;
					for (let p in result.devices[j])
					{
						if (typeof result.devices[j][p] !== 'object')
						{
							adapter.setState('devices.' + j + '.' + p, result.devices[j][p], true);
						}
						
						for (let pp in result.devices[j].metering)
						{
							if (typeof result.devices[j].metering[pp] !== 'object')
							{
								adapter.setState('devices.' + j + '.metering.' + pp, result.devices[j].metering[pp], true);								
							}
						}
						j++;
					}

					pollTimer = setTimeout(() => connectOilfox(), pollInterval);					
					
				});
			});
		  });
		  post_req2.end();
      });
  });

  adapter.log.debug("send data: " + post_data);
  post_req.write(post_data);
  post_req.end();
  
    //adapter.setState ('blabla', {val: par, ack: true});
}

function main() {
    adapter.log.debug("adapter.main: << MAIN >>");
	
	connectOilfox();
}
