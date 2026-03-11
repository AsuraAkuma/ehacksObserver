const assert = require('assert');
const PointSettings = require('../pointSettings');
const { catalog, hiddenChallengeKeys } = require('../lib/achievementsCatalog');

function ceil25(n) {
    return Math.ceil(n * 0.25);
}

function run() {
    const ps = new PointSettings();

    let total = 0;
    for (const [category, entries] of Object.entries(catalog)) {
        const pointEntries = ps.points[category] || {};
        assert.strictEqual(Object.keys(pointEntries).length, Object.keys(entries).length, `Mismatch count for ${category}`);

        const hiddenCount = Object.keys(entries).filter((key) => hiddenChallengeKeys.has(key)).length;
        assert.strictEqual(hiddenCount, ceil25(Object.keys(entries).length), `Hidden ratio mismatch for ${category}`);

        for (const key of Object.keys(entries)) {
            assert.ok(typeof pointEntries[key].check === 'function', `Missing check function for ${category}.${key}`);
            total += 1;
        }
    }

    console.log(`verifyPointsSetup: OK (${total} challenge checks validated)`);
}

try {
    run();
    process.exit(0);
} catch (error) {
    console.error('verifyPointsSetup failed:', error);
    process.exit(1);
}
