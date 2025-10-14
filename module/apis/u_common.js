const request = require('../../util/request');
const config = require('../config');
const userInfoConfig = require('../../config/user-info');

module.exports = ({ options = {}, method = 'get' }) => {
	// 优先使用全局配置的cookie，如果没有则使用本地配置
	const cookie = global.userInfo?.cookie || userInfoConfig.cookie;
	
	let opts = Object.assign(options, config.commonParams, {
		headers: {
			referer: 'https://y.qq.com/portal/player.html',
			host: 'u.y.qq.com',
			'content-type': 'application/x-www-form-urlencoded',
			'cookie': cookie,
		},
	});
	console.log('https://u.y.qq.com/cgi-bin/musicu.fcg', { opts })
	return request('https://u.y.qq.com/cgi-bin/musicu.fcg', method, opts, 'u');
};
