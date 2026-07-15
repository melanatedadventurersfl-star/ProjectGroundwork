const { createServer } = require('http');
const path = require('path');

process.chdir(path.join(__dirname, 'apps', 'member-web'));

const next = require('./apps/member-web/node_modules/next');

const port = Number.parseInt(process.env.PORT || '3000', 10);
const hostname = '0.0.0.0';
const app = next({ dev: false, hostname, port, dir: process.cwd() });
const handle = app.getRequestHandler();

app.prepare()
  .then(() => {
    createServer((req, res) => handle(req, res)).listen(port, hostname, () => {
      console.log(`MA member app listening on http://${hostname}:${port}`);
    });
  })
  .catch((error) => {
    console.error('Failed to start MA member app:', error);
    process.exit(1);
  });
