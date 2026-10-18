// Serves a CRA production build with single-page-app fallback (what Vercel does).
const http = require('http');
const fs = require('fs');
const path = require('path');

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.map': 'application/json', '.txt': 'text/plain' };

const createStaticServer = (root) => http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = path.join(root, pathname);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html');
  const headers = { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' };
  if (path.basename(file) === 'service-worker.js' || path.basename(file) === 'index.html') headers['Cache-Control'] = 'no-cache';
  res.writeHead(200, headers);
  fs.createReadStream(file).pipe(res);
});

module.exports = { createStaticServer };
