// 生产环境配置
module.exports = {
  // 服务器配置
  port: process.env.PORT || 3200,
  nodeEnv: process.env.NODE_ENV || 'production',
  
  // Cookie配置
  cookie: process.env.COOKIE || '',
  loginUin: process.env.LOGIN_UIN || '',
  
  // CORS配置
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
  },
  
  // 日志配置
  logLevel: process.env.LOG_LEVEL || 'info',
  
  // 安全配置
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 100 // 限制每个IP 15分钟内最多100个请求
  }
};
