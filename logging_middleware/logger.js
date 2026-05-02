const fs = require('fs');
const path = require('path');

const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

const logger = (req, res, next) => {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.url;
  const ip = req.ip || req.connection.remoteAddress;

  console.log(`[${timestamp}] ${method} ${url} - IP: ${ip}`);

  const logMessage = `[${timestamp}] ${method} ${url} - IP: ${ip}\n`;
  fs.appendFileSync(path.join(logsDir, 'app.log'), logMessage);

  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;
    const responseLog = `[${timestamp}] ${method} ${url} - Status: ${statusCode} - Duration: ${duration}ms\n`;
    fs.appendFileSync(path.join(logsDir, 'app.log'), responseLog);
  });

  next();
};

module.exports = logger;
