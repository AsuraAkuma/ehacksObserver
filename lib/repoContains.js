const { Octokit } = require("@octokit/rest");

module.exports = function repoContains(repo, search) {
    // Search github repo for file containing search string
    // Return true if found, false if not found
    // Use octokit to search github repo
    const octokit = new Octokit();
    return octokit.search.code({
        q: `${search}+in:file+repo:${repo}`,
    }).then(({ data }) => {
        return data.total_count > 0;
    }).catch((error) => {
        console.error(error);
        return false;
    });
}