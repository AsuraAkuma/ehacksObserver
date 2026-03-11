const { flattenCatalog } = require('../lib/achievementsCatalog');

function main() {
    const challenges = flattenCatalog();
    const totalPoints = challenges.reduce((sum, challenge) => sum + (Number(challenge.points) || 0), 0);

    console.log(`Total challenge points: ${totalPoints} (${challenges.length} challenges)`);
}

try {
    main();
    process.exit(0);
} catch (error) {
    console.error('Failed to calculate total challenge points:', error);
    process.exit(1);
}
