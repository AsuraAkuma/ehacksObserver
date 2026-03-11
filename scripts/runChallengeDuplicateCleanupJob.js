const dotenv = require('dotenv');
const {
    ensureSupplementalSchema,
    runChallengeDuplicateCleanupJob,
} = require('../lib/pointsEngine');

dotenv.config();

async function main() {
    await ensureSupplementalSchema();
    const result = await runChallengeDuplicateCleanupJob();

    console.log(
        `Challenge duplicate cleanup completed. Removed ${result.removedCount} duplicate completion(s) across ${result.affectedTeamCount} team(s); recalculated points for ${result.recalculatedMemberCount} member(s) across ${result.recalculatedTeamCount} team(s).`
    );
}

main()
    .then(() => {
        process.exit(0);
    })
    .catch((error) => {
        console.error('Challenge duplicate cleanup job failed:', error);
        process.exit(1);
    });
