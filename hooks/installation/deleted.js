const { getConnection, closeConnection } = require('../../db-connect');
const Hook = require('../../lib/hook');

module.exports = new Hook({
    name: 'Installation Deleted',
    description: 'Triggered when a GitHub App installation is deleted.',
    event: 'installation.deleted',
    action: async ({ payload }) => {
        const installationId = payload && payload.installation ? payload.installation.id : null;
        if (!installationId) {
            console.warn('installation.deleted received without installation id; nothing to clear.');
            return;
        }

        const connection = await getConnection();
        try {
            const [result] = await connection.execute(
                'UPDATE teams SET installation_id = NULL WHERE installation_id = ?',
                [installationId]
            );

            console.log(
                `installation.deleted: cleared installation_id ${installationId} from ${result.affectedRows || 0} team row(s).`
            );
        } finally {
            await closeConnection(connection);
        }
    },
});
