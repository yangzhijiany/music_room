const y_common = require('../y_common');

module.exports = ({ method = 'get', params = {}, option = {} }) => {
	const data = Object.assign(params, {
		format: 'json',
		outCharset: 'utf-8',
		utf8: 1,
		start: 0,
		num: 5,
	});
	const options = Object.assign(option, {
		params: data,
	});
	return y_common({
		url: '/v8/fcg-bin/fcg_v8_simsinger.fcg',
		method,
		options,
	})
		.then(res => {
			const response = res.data;
			return {
				status: 200,
				body: {
					response,
				},
			};
		})
		.catch(error => {
			console.log('error', error);
			return {
				body: {
					error,
				},
			};
		});
};
