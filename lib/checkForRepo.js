const { getConnection, closeConnection } = require("../db-connect");

async function checkForRepo(targetRepo) {
    const connection = await getConnection();
    const [rows] = await connection.execute(
        "SELECT github_repo from teams WHERE github_repo LIKE ?",
        [`%${targetRepo}%`]
    );
    await closeConnection(connection);
    if (rows.length == 0) {
        // The repository is not in the database, so remove the installation.
        return false;
    }
    return true;
}

module.exports = { checkForRepo };