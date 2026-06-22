// 城市生活圈监测平台 - Node.js 启动服务器
// 双击此文件或在终端运行: node start-server.js

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const ROOT = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff2':'font/woff2',
  '.woff': 'font/woff',
};

const server = http.createServer((req, res) => {
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(ROOT, decodeURIComponent(filePath));

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>404 - 文件未找到</h1>');
    } else {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache',
        // 关键：允许跨域访问
        'Access-Control-Allow-Origin': '*',
      });
      res.end(data);
    }
  });
});

server.listen(PORT, '127.0.0.1', () => {
  const url = `http://localhost:${PORT}`;
  console.log('\n╔══════════════════════════════════════╗');
  console.log('║  城市"生活圈"品质动态监测与评估平台   ║');
  console.log('║        Local Dev Server              ║');
  console.log('╚══════════════════════════════════════╝');
  console.log(`\n  服务器已启动: ${url}`);
  console.log('  按 Ctrl+C 停止服务器\n');

  // 尝试自动打开浏览器
  const { exec } = require('child_process');
  const opener = process.platform === 'win32' ? 'start' :
                 process.platform === 'darwin' ? 'open' : 'xdg-open';
  exec(`${opener} ${url}`);
});
