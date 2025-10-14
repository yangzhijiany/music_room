require('@babel/register');
const Koa = require('koa');
const http = require('http');
const app = new Koa();
const bodyParser = require('koa-bodyparser');
const path = require('path');
const static = require('koa-static');
const exec = require('child_process').exec;
const chalk = require('chalk');

const cors = require('./middlewares/koa-cors');
const router = require('./routers/router');
const cookie = require('./util/cookie');
require('./util/colors');
const userInfo = require('./config/user-info');
const package = require('./package.json');
const WebSocketServer = require('./server/websocket-server');

// 支持环境变量配置
if (process.env.NODE_ENV === 'production' && process.env.COOKIE) {
  global.userInfo = {
    loginUin: process.env.LOGIN_UIN || '',
    cookie: process.env.COOKIE,
    uin: process.env.LOGIN_UIN || '',
    cookieList: process.env.COOKIE.split('; ').map(_ => _.trim()),
    cookieObject: {}
  };
  
  // 解析cookie对象
  global.userInfo.cookieList.filter(Boolean).forEach(_ => {
    if (_) {
      const [key, value = ''] = _.split('=');
      global.userInfo.cookieObject[key] = value;
    }
  });
} else {
  global.userInfo = Object.assign({}, userInfo);
}

console.log(chalk.green('\n🥳🎉 We had supported config the user cookies. \n'));

if (!(global.userInfo.loginUin || global.userInfo.uin)) {
  console.log(chalk.yellow(`😔 The configuration ${chalk.red('loginUin')} or your ${chalk.red('cookie')} in file ${chalk.green('config/user-info')} has not configured. \n`));
}

if (!global.userInfo.cookie) {
  console.log(chalk.yellow(`😔 The configuration ${chalk.red('cookie')} in file ${chalk.green('config/user-info')} has not configured. \n`));
}

exec('npm info QQ-Music-API version', (err, stdout, stderr) => {
  if(!err){
    let version = stdout.trim();
    if(package.version < version){
      console.log(`Current Version: ${version}, Current Version: ${package.version}, Please update it.`.prompt);
    }
  }
});

app.use(bodyParser());
app.use(cookie());
app.use(static(
  path.join(__dirname,  'public')
));

// logger
app.use(async (ctx, next) => {
  await next();
  const rt = ctx.response.get('X-Response-Time');
  console.log(`${ctx.method} ${ctx.url} - ${rt}`.prompt);
});

// cors
app.use(cors({
  origin: (ctx) => ctx.request.header.origin,
  exposeHeaders: ['WWW-Authenticate', 'Server-Authorization'],
  maxAge: 5,
  credentials: true,
  allowMethods: ['GET', 'POST', 'DELETE'],
  allowHeaders: ['Content-Type', 'Authorization', 'Accept'],
}));

// x-response-time
app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  ctx.set('X-Response-Time', `${ms}ms`);
});

app.use(router.routes())
  .use(router.allowedMethods());

const PORT = process.env.PORT || 3200;

// 创建HTTP服务器
const server = http.createServer(app.callback());

// 启动WebSocket服务器
const wsServer = new WebSocketServer(server);

// 添加房间列表API
router.get('/api/rooms', async (ctx) => {
  ctx.body = {
    success: true,
    rooms: wsServer.getRoomList()
  };
});

// 添加房间信息API
router.get('/api/room/:roomId', async (ctx) => {
  const roomId = ctx.params.roomId;
  const room = wsServer.getRoomInfo(roomId);
  
  if (room) {
    ctx.body = {
      success: true,
      room: {
        id: room.id,
        name: room.name,
        userCount: room.users.size,
        currentSong: room.currentSong,
        isPlaying: room.isPlaying,
        playlist: room.playlist
      }
    };
  } else {
    ctx.body = {
      success: false,
      error: '房间不存在'
    };
  }
});

server.listen(PORT, () => {
  console.log(`server running @ http://localhost:${PORT}`.prompt);
  console.log(`WebSocket server running on port ${PORT}`.prompt);
});
