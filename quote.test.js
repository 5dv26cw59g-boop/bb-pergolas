import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from './index.js';

let server;

test('quote endpoint validates dimensions and returns order payload', async () => {
  server = createServer(0);

  await new Promise((resolve) => {
    server.once('listening', resolve);
  });

  const port = server.address().port;

  const response = await fetch(`http://localhost:${port}/api/quote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      productId: 'pergola-bioclimatique',
      materialId: 'alu',
      widthCm: 500,
      depthCm: 350,
      optionIds: ['led'],
      typeClient: 'particulier',
    }),
  });

  assert.equal(response.status, 200);
  const data = await response.json();
  assert.ok(data.totalHT > 0);
  assert.ok(data.totalTTC > data.totalHT);
  assert.equal(typeof data.orderId, 'string');

  await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
});

process.on('exit', () => {
  if (server) {
    server.close();
  }
});
