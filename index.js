const http = require('http');
const https = require('https');
const url = require('url');

const PORT = process.env.PORT || 3000;

const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === '/' || req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('GoldStream Proxy OK');
    return;
  }

  const parsed = url.parse(req.url, true);
  const target = parsed.query.url;

  if (!target) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Missing ?url= param' }));
    return;
  }

  let targetUrl;
  try {
    targetUrl = new URL(target);
    if (!['http:', 'https:'].includes(targetUrl.protocol)) throw new Error();
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid URL' }));
    return;
  }

  const lib = targetUrl.protocol === 'https:' ? https : http;

  const options = {
    hostname: targetUrl.hostname,
    port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
    path: targetUrl.pathname + targetUrl.search,
    method: 'GET',
    headers: {
      'User-Agent': 'IPTV-Player/9.0 (Android; Mobile)',
      'Accept': '*/*',
      'Cache-Control': 'no-cache',
    },
    timeout: 20000,
  };

  try {
    const proxyReq = lib.request(options, (proxyRes) => {
      const ct = proxyRes.headers['content-type'] || 'application/octet-stream';
      res.writeHead(proxyRes.statusCode, {
        'Content-Type': ct,
        'Cache-Control': 'public, max-age=60',
        'Access-Control-Allow-Origin': '*',
      });
      proxyRes.pipe(res);
    });

    proxyReq.on('timeout', () => {
      proxyReq.destroy();
      res.writeHead(504, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Timeout' }));
    });

    proxyReq.on('error', (e) => {
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });

    proxyReq.end();
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message }));
  }
});

server.listen(PORT, () => {
  console.log('GoldStream Proxy rodando na porta ' + PORT);
});
