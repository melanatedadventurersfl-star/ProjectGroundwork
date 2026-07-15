const http = require('http');

const port = Number.parseInt(process.env.PORT || '3000', 10);
const host = '0.0.0.0';

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>GoMelanated Connection Test</title>
</head>
<body style="font-family:Arial,sans-serif;max-width:720px;margin:60px auto;padding:0 20px;line-height:1.5">
  <h1>GoMelanated is connected</h1>
  <p>The Hostinger Node.js runtime is serving this page successfully.</p>
  <p><strong>Host:</strong> ${req.headers.host || 'unknown'}</p>
  <p><strong>Path:</strong> ${req.url}</p>
</body>
</html>`);
});

server.listen(port, host, () => {
  console.log(`Smoke test listening on http://${host}:${port}`);
});
