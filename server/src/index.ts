import { createServer } from 'http';
import { loadConfig } from './config/index.js';
import { getLogger } from './config/logger.js';
import { WSGateway } from './ws/gateway.js';

const config = loadConfig();
const log = getLogger();

const httpServer = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
    return;
  }

  const parsed = new URL(req.url ?? '', `http://${req.headers.host ?? 'localhost'}`);
  if (parsed.pathname === '/api/room/check' && req.method === 'GET') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const code = parsed.searchParams.get('code')?.toUpperCase();
    if (!code) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'code query parameter is required' }));
      return;
    }
    const exists = gateway.hasRoom(code);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ available: !exists }));
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
