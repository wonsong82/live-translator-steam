import { createServer } from 'http';
import { loadConfig } from './config/index.js';
import { getLogger } from './config/logger.js';
import { WSGateway } from './ws/gateway.js';

const config = loadConfig();
const log = getLogger();

const httpServer = createServer((_req, res) => {
  if (_req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const gateway = new WSGateway(httpServer);
const heartbeatTimer = gateway.startHeartbeat();

httpServer.listen(config.PORT, () => {
  log.info({ port: config.PORT, env: config.NODE_ENV }, 'server started');
});

async function shutdown(signal: string): Promise<void> {
  log.info({ signal }, 'shutting down');
  clearInterval(heartbeatTimer);
  await gateway.shutdown();
  httpServer.close();
  process.exit(0);
}

process.on('SIGINT', () => { void shutdown('SIGINT'); });
process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
