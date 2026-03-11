// Configure app and globals
const dotenv = require('dotenv');
const { App } = require("octokit");
const { createNodeMiddleware } = require("@octokit/webhooks");
const fs = require("fs");
const http = require("http");
const { getConnection, closeConnection } = require('./db-connect');
const {
    ensureSupplementalSchema,
    ensureChallengesSeeded,
    runScheduledHighLoadChecks,
} = require('./lib/pointsEngine');

dotenv.config();

const appId = process.env.APP_ID;
const webhookSecret = process.env.WEBHOOK_SECRET;
const privateKeyPath = process.env.PRIVATE_KEY_PATH;
const webhookPort = process.env.WEBHOOK_PORT || 5508;
const webhookHost = process.env.WEBHOOK_HOST || '0.0.0.0';

const privateKey = fs.readFileSync(privateKeyPath, "utf8");

const app = new App({
    appId: appId,
    privateKey: privateKey,
    webhooks: {
        secret: webhookSecret
    },
});

async function initializePointsEngine() {
    await ensureSupplementalSchema();
    await ensureChallengesSeeded();
}

initializePointsEngine().then(() => {
    console.log('Points engine schema and challenge catalog initialized.');
}).catch((error) => {
    console.error('Failed to initialize points engine:', error);
    process.exit(1);
});

// Test app
app.octokit.request("GET /app", {
    headers: {
        "x-github-api-version": "2022-11-28",
    },
}).then(({ data }) => {
    console.log(`Authenticated as ${data.name} (${data.slug})`);
}).catch((error) => {
    if (error.response) {
        console.error(`Error! Status: ${error.response.status}. Message: ${error.response.data.message}`)
    }
    console.error(error)
    process.exit(1);
});

// Check for current installations
// Check for current installations and list repositories for each installation
app.octokit.request('GET /app/installations', {
    headers: {
        'x-github-api-version': '2022-11-28'
    }
}).then(async ({ data }) => {
    if (!data || data.length === 0) {
        console.log('You have no current installations.');
        return [];
    }

    console.log(`Found ${data.length} installation(s).`);
    const installationRepos = [];
    for (const installation of data) {
        try {
            const installationId = installation.id;
            const installationOctokit = await app.getInstallationOctokit(installationId);
            const reposResponse = await installationOctokit.request('GET /installation/repositories', {
                headers: { 'x-github-api-version': '2022-11-28' }
            });

            const repos = reposResponse.data && reposResponse.data.repositories ? reposResponse.data.repositories : [];
            // console.log(`Installation: ${installation.account.login} (id: ${installationId}) — ${repos.length} repo(s)`);
            for (const repo of repos) {
                repo['installationId'] = installationId; // Add installation ID to each repo for later reference
            }
            installationRepos.push(...repos);
        } catch (err) {
            if (err.response) {
                console.error(`Error for installation ${installation.id}! Status: ${err.response.status}. Message: ${err.response.data && err.response.data.message}`);
            } else {
                console.error(err);
            }
        }
    }
    // console.log('Current repositories with access: ', installationRepos.map(r => r.full_name));
    const connection = await getConnection();
    const [rows] = await connection.execute(
        "SELECT github_repo, installation_id from teams"
    );
    await closeConnection(connection);
    // console.log('Repositories in database: ', rows.map(r => r.github_repo));
    if (rows.length > 0) {
        const repoNamesInDatabase = rows.map(r => r.github_repo.split("/").slice(-2).join("/"));
        // console.log(`Repo names in database: `, repoNamesInDatabase);
        // console.log(`rows:`, rows);

        for (const installedRepo of installationRepos) {
            const repoName = installedRepo.full_name;
            // console.log(`Checking if ${repoName} is in the list of repositories with access...`);
            // console.log(`${repoName}: ${repoNamesInDatabase.includes(repoName)}`)
            if (repoNamesInDatabase.includes(repoName)) {
                const matchingRow = rows.find(r => r.github_repo.split("/").slice(-2).join("/") === repoName);
                // console.log(matchingRow)
                if (!matchingRow.installation_id) {
                    // console.log(`Setting installation ID for ${repoName} in database...`);
                    // set installation ID in database for later reference
                    const connection = await getConnection();
                    await connection.execute(
                        "UPDATE teams SET installation_id = ? WHERE github_repo LIKE ?",
                        [installedRepo.installationId, `%${repoName}%`]
                    );
                    await closeConnection(connection);
                }
            }
        }
    }

}).catch((error) => {
    if (error.response) {
        console.error(`Error! Status: ${error.response.status}. Message: ${error.response.data && error.response.data.message}`)
    }
    console.error(error);
    process.exit(1);
});
// Create lists of hooks
const hooks = new Array();
const targetFolder = "./hooks";

for (const folder of fs.readdirSync(fs.realpathSync(targetFolder))) {
    if (folder.endsWith(".js")) continue;
    for (const file of fs.readdirSync(`${targetFolder}/${folder}`)) {
        if (file.endsWith(".js")) {
            const hook = require(`${targetFolder}/${folder}/${file}`);
            hooks.push(hook);
        }
    }
}
console.log(`Loaded ${hooks.length} hooks.\n\n${hooks.map(hook => `- ${hook.name}: ${hook.description}`).join("\n")}`);

// This sets up a webhook event listener. When your app receives a webhook event from GitHub with a `X-GitHub-Event` header value of `pull_request` and an `action` payload value of `opened`, it calls the `handlePullRequestOpened` event handler that is defined above.
app.webhooks.onAny((event) => {
    void handleRequest(event);
});

async function handleRequest(event) {
    console.log(`Received event: ${event.name} with action: ${event.payload.action}`);
    const hookEvent = `${event.name}${event.payload.action ? `.${event.payload.action}` : ''}`;
    const hook = hooks.find((item) => item.event === hookEvent);
    if (hook) {
        try {
            await hook.action({
                octokit: app.octokit,
                payload: event.payload,
                app,
                meta: {
                    deliveryId: event.id,
                    eventName: event.name,
                    eventAction: event.payload.action || null,
                },
            });
        } catch (error) {
            console.error(`Hook execution failed for ${hookEvent}:`, error);
        }
    } else {
        console.log(`No hook registered for webhook key: ${hookEvent}`);
    }
}
// This logs any errors that occur.
app.webhooks.onError((error) => {
    if (error.name === "AggregateError") {
        console.error(`Error processing request: ${error.event}`);
    } else {
        console.error(error);
    }
});

// This determines where your server will listen.
//
// For local development, your server will listen to port 3000 on `localhost`. When you deploy your app, you will change these values. For more information, see [Deploy your app](#deploy-your-app).
const host = webhookHost;
const path = "/api/webhook";
const localWebhookUrl = `http://${host}:${webhookPort}${path}`;

// This sets up a middleware function to handle incoming webhook events.
//
// Octokit's `createNodeMiddleware` function takes care of generating this middleware function for you. The resulting middleware function will:
//
// - Check the signature of the incoming webhook event to make sure that it matches your webhook secret. This verifies that the incoming webhook event is a valid GitHub event.
// - Parse the webhook event payload and identify the type of event.
// - Trigger the corresponding webhook event handler.
const middleware = createNodeMiddleware(app.webhooks, { path });

// This creates a Node.js server that listens for incoming HTTP requests (including webhook payloads from GitHub) on the specified port. When the server receives a request, it executes the `middleware` function that you defined earlier. Once the server is running, it logs messages to the console to indicate that it is listening.
http.createServer(middleware).listen(webhookPort, () => {
    console.log(`Server is listening for events at: ${localWebhookUrl}`);
    console.log('Press Ctrl + C to quit.')
});

const highLoadIntervalMinutes = parseInt(process.env.HIGH_LOAD_INTERVAL_MINUTES || '30', 10);
const highLoadIntervalMs = Math.max(30, highLoadIntervalMinutes) * 60 * 1000;

setInterval(() => {
    void runScheduledHighLoadChecks(app).catch((error) => {
        console.error('Scheduled high-load check run failed:', error);
    });
}, highLoadIntervalMs);
