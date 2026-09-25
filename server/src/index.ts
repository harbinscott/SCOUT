import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import { createApp } from './app.js';
import { config } from './config.js';

const app = createApp(config);
const server = config.HTTPS_ENABLED
  ? https.createServer({
      cert: fs.readFileSync(config.TLS_CERT_FILE),
      key: fs.readFileSync(config.TLS_KEY_FILE),
    }, app)
  : http.createServer(app);

server.listen(config.PORT, config.HOST, () => {
  const scheme = config.HTTPS_ENABLED ? 'https' : 'http';
  console.log(`SCOUT listening at ${scheme}://${config.HOST}:${config.PORT}${config.BASE_PATH}/ (${config.USE_MOCK_DATA ? 'mock' : 'live'} mode)`);
});

function shutdown() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
