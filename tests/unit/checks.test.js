const test = require('node:test');
const assert = require('node:assert/strict');
const { checks, DEFAULT_EVENT_END_TIMESTAMP } = require('../../lib/checks');

test('repository checks detect language thresholds and polyglot count', () => {
    const filePaths = [
        ...Array.from({ length: 10 }, (_, i) => `src/file_${i}.ts`),
        'app/main.py',
        'api/index.js',
        'core/Main.java',
        'cmd/tool.go',
    ];

    assert.equal(checks.repository.typed_architect({ repositoryFacts: { filePaths } }), true);
    assert.equal(checks.repository.polyglot_builder({ repositoryFacts: { filePaths } }), true);
});

test('final_hour_sprint uses configured event timestamp when provided', () => {
    const original = process.env.EVENT_END_TIMESTAMP;
    process.env.EVENT_END_TIMESTAMP = '20000';

    assert.equal(checks.repository.final_hour_sprint({ commitFacts: { timestamp: 20000 - 3600 } }), true);
    assert.equal(checks.repository.final_hour_sprint({ commitFacts: { timestamp: 20000 - (3 * 3600) } }), false);

    if (typeof original === 'undefined') {
        delete process.env.EVENT_END_TIMESTAMP;
    } else {
        process.env.EVENT_END_TIMESTAMP = original;
    }
});

test('final_hour_sprint falls back to default timestamp for invalid env value', () => {
    const original = process.env.EVENT_END_TIMESTAMP;
    process.env.EVENT_END_TIMESTAMP = 'invalid';

    const inFinalTwoHours = DEFAULT_EVENT_END_TIMESTAMP - 3600;
    const outsideFinalTwoHours = DEFAULT_EVENT_END_TIMESTAMP - (4 * 3600);

    assert.equal(checks.repository.final_hour_sprint({ commitFacts: { timestamp: inFinalTwoHours } }), true);
    assert.equal(checks.repository.final_hour_sprint({ commitFacts: { timestamp: outsideFinalTwoHours } }), false);

    if (typeof original === 'undefined') {
        delete process.env.EVENT_END_TIMESTAMP;
    } else {
        process.env.EVENT_END_TIMESTAMP = original;
    }
});

test('commit checks evaluate conventional commit and breaking change markers', () => {
    assert.equal(checks.commit.feature_builder({ commitFacts: { message: 'FEAT: add endpoint' } }), true);
    assert.equal(checks.commit.bug_slayer({ commitFacts: { message: 'Fix token handling' } }), true);
    assert.equal(checks.commit.breaking_changes({ commitFacts: { message: 'feat!: update API\n\nBREAKING CHANGE: drop v1' } }), true);
    assert.equal(checks.commit.breaking_changes({ commitFacts: { message: 'breaking change lowercase only' } }), false);
});

test('branch checks detect naming patterns', () => {
    assert.equal(checks.branch.feature_flow({ branchFacts: { branchName: 'feature/leaderboard' } }), true);
    assert.equal(checks.branch.hotfix_hero({ branchFacts: { branchName: 'hotfix/fix-auth' } }), true);
    assert.equal(checks.branch.ticket_tracker({ branchFacts: { branchName: 'feature/EHACKS-123-points' } }), true);

    const namingConventionStats = {
        branchPrefixCounts: [{ key: 'feature/', count: 3 }],
        commitPrefixCounts: [{ key: 'feat:', count: 2 }],
        separatorCounts: [{ key: '/', count: 2 }],
        caseCounts: [{ key: 'kebab', count: 2 }],
    };
    assert.equal(checks.branch.naming_master({ namingConventionStats }), true);
});

test('file checks detect dependency and test related changes', () => {
    const commitFacts = {
        changedFiles: [
            'package.json',
            'tests/points-engine.test.js',
            'docs/README.md',
            'Dockerfile',
        ],
        fileExtensionsTouched: ['js', 'md', 'json'],
        additions: 600,
        deletions: 350,
    };

    assert.equal(checks.file.dependency_manager({ commitFacts }), true);
    assert.equal(checks.file.test_contributor({ commitFacts }), true);
    assert.equal(checks.file.documentation_advocate({ commitFacts }), true);
    assert.equal(checks.file.container_captain({ commitFacts }), true);
    assert.equal(checks.file.full_stack_commit({ commitFacts }), true);
    assert.equal(checks.file.heavy_lifter({ commitFacts }), true);
    assert.equal(checks.file.code_cleaner({ commitFacts }), true);
});
