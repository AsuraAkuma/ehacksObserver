const Hook = require("../../lib/hook");

module.exports = new Hook({
    name: "name",
    description: "description",
    event: "event",
    action: async ({ octokit, payload }) => {
        console.log("octokit: ", octokit);
        console.log("payload: ", payload);
        // const { repository } = payload;
        // const { owner, name } = repository;
        // console.log(`Repository ${owner.login}/${name} was added to the organization.`);
    }
})