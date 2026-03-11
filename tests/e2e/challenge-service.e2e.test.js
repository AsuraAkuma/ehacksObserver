const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const runService = require('../../challenge-fixtures/backend/service');

function createServer() {
    return http.createServer((req, res) => {
        if (req.method === 'GET' && req.url === '/health') {
            const payload = {
                status: 'ok',
                service: runService(),
            };

            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(JSON.stringify(payload));
            return;
        }

        res.writeHead(404, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'not_found' }));
    });
}

test('e2e health endpoint returns backend fixture payload', async () => {
    const server = createServer();
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

    try {
        const address = server.address();
        const response = await fetch(`http://127.0.0.1:${address.port}/health`);
        const body = await response.json();

        assert.equal(response.status, 200);
        assert.equal(body.status, 'ok');
        assert.equal(body.service.ok, true);
        assert.equal(body.service.area, 'backend');
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
});

test('e2e returns 404 for unknown routes', async () => {
    const server = createServer();
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

    try {
        const address = server.address();
        const response = await fetch(`http://127.0.0.1:${address.port}/missing`);
        const body = await response.json();

        assert.equal(response.status, 404);
        assert.equal(body.error, 'not_found');
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
});
