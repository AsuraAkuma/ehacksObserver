const Hook = require("../../lib/hook");
const { processPushEvent } = require('../../lib/pointsEngine');

module.exports = new Hook({
    name: "Push",
    description: "Triggered when a push event occurs in a repository.",
    event: "push",
    action: async ({ payload, app, meta }) => {
        await processPushEvent({
            payload,
            app,
            deliveryId: meta ? meta.deliveryId : null,
        });
    }
});

