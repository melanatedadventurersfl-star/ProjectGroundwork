const http = require('http');
const next = require('next');

const dev = false;
const hostname = '0.0.0.0';
const port = Number.parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare()
  .then(() => {
    const server = http.createServer((req, res) => {
      handle(req, res);
    });

    server.listen(port, hostname, () => {
      console.log(`Next.js server listening on http://${hostname}:${port}`);
    });
  })
  .catch((error) => {
    console.error('Failed to start Next.js server:', error);
    process.exit(1);
  });
