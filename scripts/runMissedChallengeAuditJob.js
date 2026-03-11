const dotenv = require('dotenv');
const fs = require('fs');
const { App } = require('octokit');
const {
    ensureSupplementalSchema,
    ensureChallengesSeeded,
    runScheduledHighLoadChecks,
} = require('../lib/pointsEngine');

dotenv.config();

async function main() {
    const appId = process.env.APP_ID;
    const webhookSecret = process.env.WEBHOOK_SECRET;
    const privateKeyPath = process.env.PRIVATE_KEY_PATH;

    if (!appId || !webhookSecret || !privateKeyPath) {
        throw new Error('APP_ID, WEBHOOK_SECRET, and PRIVATE_KEY_PATH are required.');
    }

    const privateKey = fs.readFileSync(privateKeyPath, 'utf8');

    const app = new App({
        appId,
        privateKey,
        webhooks: { secret: webhookSecret },
    });

    await ensureSupplementalSchema();
    await ensureChallengesSeeded();
    await runScheduledHighLoadChecks(app);

    console.log('Missed challenge audit job completed.');
}

main()
    .then(() => {
        process.exit(0);
    })
    .catch((error) => {
        console.error('Missed challenge audit job failed:', error);
        process.exit(1);
    });
