const dotenv = require('dotenv');
const {
    ensureSupplementalSchema,
    runPointsRecalculationJob,
} = require('../lib/pointsEngine');

dotenv.config();

async function main() {
    await ensureSupplementalSchema();
    const result = await runPointsRecalculationJob();

    console.log(
        `Points recalculation completed. Recalculated points for ${result.recalculatedMemberCount} member(s) across ${result.recalculatedTeamCount} team(s).`
    );
}

main()
    .then(() => {
        process.exit(0);
    })
    .catch((error) => {
        console.error('Points recalculation job failed:', error);
        process.exit(1);
    });
