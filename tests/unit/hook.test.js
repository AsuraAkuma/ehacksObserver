const test = require('node:test');
const assert = require('node:assert/strict');
const Hook = require('../../lib/hook');

test('Hook stores constructor properties', async () => {
    const action = async () => 'ok';
    const hook = new Hook({
        name: 'Push Handler',
        description: 'Handles push events',
        event: 'push',
        action,
    });

    assert.equal(hook.name, 'Push Handler');
    assert.equal(hook.description, 'Handles push events');
    assert.equal(hook.event, 'push');
    assert.equal(await hook.action(), 'ok');
});
