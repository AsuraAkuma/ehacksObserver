const { checkForRepo } = require("../../lib/checkForRepo");
const Hook = require("../../lib/hook");
const { getConnection, closeConnection } = require('../../db-connect');

module.exports = new Hook({
    name: "Repository Added",
    description: "Triggered when a repository is added to an organization.",
    event: "installation_repositories.added",
    action: async ({ octokit, payload }) => {
        // console.log("octokit: ", octokit);
        // console.log("payload: ", payload);
        const { repositories_added: repositories } = payload;
        const reposData = repositories.map(r => ({ full_name: r.full_name, isPrivate: r.private }));
        let hasRepoInDatabase = false;
        const connection = await getConnection();
        for (const { full_name, isPrivate } of reposData) {
            // console.log(`Repository ${full_name} was added to the organization. Private: ${isPrivate}`);
            if (await checkForRepo(full_name)) {
                hasRepoInDatabase = true;
                // console.log(`Repository ${full_name} is in the database. Setting installation ID to ${payload.installation.id}...`);
                await connection.execute(
                    "UPDATE teams SET installation_id = ? WHERE github_repo LIKE ? AND installation_id IS NULL",
                    [payload.installation.id, `%${full_name}%`]
                );
            }
        }
        await closeConnection(connection);
        if (!hasRepoInDatabase) {
            // console.log(`Repository ${full_name} is not in the database. Removing installation.`);
            await octokit.request(`DELETE /app/installations/${payload.installation.id}`, {
                headers: {
                    "x-github-api-version": "2022-11-28",
                },
            });
            return;
        }
    }
})