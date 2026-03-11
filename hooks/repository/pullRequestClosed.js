const Hook = require('../../lib/hook');
const { processPullRequestClosedEvent } = require('../../lib/pointsEngine');

module.exports = new Hook({
    name: 'Pull Request Closed',
    description: 'Triggered when a pull request is closed in a repository.',
    event: 'pull_request.closed',
    action: async ({ payload, app, meta }) => {
        await processPullRequestClosedEvent({
            payload,
            app,
            deliveryId: meta ? meta.deliveryId : null,
        });
    },
});
