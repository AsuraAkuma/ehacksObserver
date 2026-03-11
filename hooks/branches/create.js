const Hook = require('../../lib/hook');
const { processCreateEvent } = require('../../lib/pointsEngine');

module.exports = new Hook({
    name: 'Branch Created',
    description: 'Triggered when a branch is created in a repository.',
    event: 'create',
    action: async ({ payload, app, meta }) => {
        await processCreateEvent({
            payload,
            app,
            deliveryId: meta ? meta.deliveryId : null,
        });
    },
});
