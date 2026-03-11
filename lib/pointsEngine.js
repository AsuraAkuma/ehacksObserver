const { getConnection, closeConnection } = require('../db-connect');
const { catalog, flattenCatalog } = require('./achievementsCatalog');
const { checks } = require('./checks');

const STRUCTURED_PREFIXES = ['feat:', 'fix:', 'refactor:', 'docs:', 'test:', 'chore:'];
const DOC_KEYWORDS = ['docs', 'readme', 'contributing', 'documentation', 'doc:'];
const TEST_KEYWORDS = ['test', 'tests', 'testing', 'coverage', 'ci', 'travis', 'circleci', 'github actions'];
const REFACTOR_KEYWORDS = ['refactor', 'cleanup', 'restructure'];
const AREA_KEYWORDS = ['docs', 'frontend', 'backend', 'data'];
const BRANCH_PREFIXES = ['feat/', 'fix/', 'feature/', 'hotfix/', 'release/'];

function toUnixSeconds(isoDate) {
    if (!isoDate) return 0;
    const value = Math.floor(new Date(isoDate).getTime() / 1000);
    return Number.isFinite(value) ? value : 0;
}

function normalizeMessage(message) {
    return String(message || '').toLowerCase();
}

function uniqueStrings(values) {
    return [...new Set((values || []).filter(Boolean))];
}

function inferCaseStyle(branchName) {
    if (!branchName) return 'none';
    const leaf = String(branchName).split('/').pop() || '';
    if (/-/.test(leaf)) return 'kebab';
    if (/_/.test(leaf)) return 'snake';
    if (/[a-z][A-Z]/.test(leaf)) return 'camel';
    return 'plain';
}

function inferSeparator(branchName) {
    if (!branchName) return 'none';
    if (branchName.includes('/')) return '/';
    if (branchName.includes('-')) return '-';
    if (branchName.includes('_')) return '_';
    return 'none';
}

function toNumericCommitId(sha) {
    if (!sha) return 0;
    try {
        const raw = BigInt(`0x${sha.slice(0, 12)}`);
        return Number(raw % 2147483647n) + 1;
    } catch (err) {
        return 0;
    }
}

function toNumericPushId(payload) {
    const direct = payload.push_id;
    if (Number.isFinite(direct)) return direct;
    if (payload.after) {
        try {
            const raw = BigInt(`0x${String(payload.after).slice(0, 12)}`);
            return Number(raw % 2147483647n) + 1;
        } catch (err) {
            return 0;
        }
    }
    return 0;
}

function resolveBranchCreatedAtUnix(payload) {
    const pushedAt = payload && payload.repository ? payload.repository.pushed_at : null;

    // GitHub payloads may provide pushed_at as unix seconds, unix milliseconds, or an ISO string.
    if (typeof pushedAt === 'number' && Number.isFinite(pushedAt)) {
        if (pushedAt > 1e12) return Math.floor(pushedAt / 1000);
        if (pushedAt > 0) return Math.floor(pushedAt);
    }

    if (typeof pushedAt === 'string' && pushedAt.trim()) {
        const numeric = Number(pushedAt);
        if (Number.isFinite(numeric) && numeric > 0) {
            if (numeric > 1e12) return Math.floor(numeric / 1000);
            return Math.floor(numeric);
        }

        const parsed = Date.parse(pushedAt);
        if (Number.isFinite(parsed)) {
            return Math.floor(parsed / 1000);
        }
    }

    return Math.floor(Date.now() / 1000);
}

async function ensureSupplementalSchema() {
    const connection = await getConnection();
    try {
        await connection.execute(
            `CREATE TABLE IF NOT EXISTS webhook_deliveries (
                delivery_id varchar(128) NOT NULL,
                event_name varchar(100) NOT NULL,
                event_action varchar(100) DEFAULT NULL,
                repo_id int(11) DEFAULT NULL,
                received_at datetime(6) NOT NULL,
                processed_at datetime(6) DEFAULT NULL,
                status varchar(30) NOT NULL DEFAULT 'received',
                error_message varchar(2000) DEFAULT NULL,
                PRIMARY KEY (delivery_id),
                KEY idx_webhook_repo_event (repo_id, event_name, event_action)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`
        );

        await connection.execute(
            `CREATE TABLE IF NOT EXISTS commit_details (
                id bigint(20) NOT NULL AUTO_INCREMENT,
                repo_id int(11) NOT NULL,
                installation_id int(11) DEFAULT NULL,
                push_id int(11) DEFAULT NULL,
                commit_sha varchar(40) NOT NULL,
                author_email varchar(255) DEFAULT NULL,
                author_username varchar(255) DEFAULT NULL,
                committed_at bigint(20) NOT NULL,
                message text NOT NULL,
                additions int(11) NOT NULL DEFAULT 0,
                deletions int(11) NOT NULL DEFAULT 0,
                changed_files_json longtext DEFAULT NULL,
                top_level_dirs_json longtext DEFAULT NULL,
                file_extensions_json longtext DEFAULT NULL,
                created_at datetime(6) NOT NULL DEFAULT current_timestamp(6),
                PRIMARY KEY (id),
                UNIQUE KEY uk_commit_details_repo_sha (repo_id, commit_sha),
                KEY idx_commit_details_repo_author_time (repo_id, author_email, committed_at),
                KEY idx_commit_details_repo_username_time (repo_id, author_username, committed_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`
        );

        await connection.execute(
            `CREATE TABLE IF NOT EXISTS pull_request_events (
                id bigint(20) NOT NULL AUTO_INCREMENT,
                repo_id int(11) NOT NULL,
                installation_id int(11) DEFAULT NULL,
                pr_number int(11) NOT NULL,
                author_username varchar(255) DEFAULT NULL,
                author_email varchar(255) DEFAULT NULL,
                opened_at bigint(20) NOT NULL,
                closed_at bigint(20) DEFAULT NULL,
                merged_at bigint(20) DEFAULT NULL,
                is_merged bit(1) NOT NULL DEFAULT b'0',
                additions int(11) NOT NULL DEFAULT 0,
                deletions int(11) NOT NULL DEFAULT 0,
                changed_files_json longtext DEFAULT NULL,
                updated_at datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
                PRIMARY KEY (id),
                UNIQUE KEY uk_pr_events_repo_number (repo_id, pr_number),
                KEY idx_pr_events_repo_author (repo_id, author_username),
                KEY idx_pr_events_repo_merged (repo_id, is_merged, merged_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`
        );

        await connection.execute(
            `CREATE TABLE IF NOT EXISTS branch_events (
                id bigint(20) NOT NULL AUTO_INCREMENT,
                repo_id int(11) NOT NULL,
                installation_id int(11) DEFAULT NULL,
                branch_name varchar(255) NOT NULL,
                creator_username varchar(255) DEFAULT NULL,
                creator_email varchar(255) DEFAULT NULL,
                created_at_unix bigint(20) NOT NULL,
                created_at datetime(6) NOT NULL DEFAULT current_timestamp(6),
                PRIMARY KEY (id),
                UNIQUE KEY uk_branch_events_repo_branch (repo_id, branch_name),
                KEY idx_branch_events_repo_creator (repo_id, creator_username),
                KEY idx_branch_events_repo_created_at_unix (repo_id, created_at_unix)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`
        );

        await connection.execute(
            `CREATE TABLE IF NOT EXISTS repo_aggregate_cache (
                repo_id int(11) NOT NULL,
                file_count int(11) NOT NULL DEFAULT 0,
                language_counts_json longtext DEFAULT NULL,
                branch_naming_conventions_json longtext DEFAULT NULL,
                contributor_count int(11) NOT NULL DEFAULT 0,
                commit_count int(11) NOT NULL DEFAULT 0,
                has_readme bit(1) NOT NULL DEFAULT b'0',
                has_license bit(1) NOT NULL DEFAULT b'0',
                has_contributing bit(1) NOT NULL DEFAULT b'0',
                has_tests_dir bit(1) NOT NULL DEFAULT b'0',
                readme_text longtext DEFAULT NULL,
                computed_at datetime(6) NOT NULL,
                PRIMARY KEY (repo_id),
                KEY idx_repo_cache_computed_at (computed_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`
        );

        await connection.execute(
            `CREATE TABLE IF NOT EXISTS scheduler_runs (
                id bigint(20) NOT NULL AUTO_INCREMENT,
                job_name varchar(150) NOT NULL,
                started_at datetime(6) NOT NULL,
                finished_at datetime(6) DEFAULT NULL,
                status varchar(20) NOT NULL DEFAULT 'running',
                details varchar(2000) DEFAULT NULL,
                PRIMARY KEY (id),
                KEY idx_scheduler_job_started (job_name, started_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`
        );

        try {
            await connection.execute(
                'ALTER TABLE challenge_completions ADD UNIQUE KEY uk_challenge_completions_user_challenge (user_id, challenge_id)'
            );
        } catch (err) {
            if (!String(err.message || '').includes('Duplicate key name')) {
                throw err;
            }
        }
    } finally {
        await closeConnection(connection);
    }
}

async function registerDeliveryIfNew({ deliveryId, eventName, eventAction, repoId }) {
    if (!deliveryId) return true;
    const connection = await getConnection();
    try {
        const [rows] = await connection.execute('SELECT delivery_id FROM webhook_deliveries WHERE delivery_id = ?', [deliveryId]);
        if (rows.length > 0) {
            return false;
        }
        await connection.execute(
            `INSERT INTO webhook_deliveries (delivery_id, event_name, event_action, repo_id, received_at, status)
             VALUES (?, ?, ?, ?, NOW(6), 'received')`,
            [deliveryId, eventName, eventAction || null, repoId || null]
        );
        return true;
    } finally {
        await closeConnection(connection);
    }
}

async function markDeliveryComplete(deliveryId, status, errorMessage) {
    if (!deliveryId) return;
    const connection = await getConnection();
    try {
        await connection.execute(
            `UPDATE webhook_deliveries
             SET processed_at = NOW(6), status = ?, error_message = ?
             WHERE delivery_id = ?`,
            [status, errorMessage || null, deliveryId]
        );
    } finally {
        await closeConnection(connection);
    }
}

async function findTeamByRepoFullName(repoFullName) {
    const connection = await getConnection();
    try {
        const [rows] = await connection.execute(
            'SELECT id FROM teams WHERE github_repo LIKE ? LIMIT 1',
            [`%${repoFullName}%`]
        );
        return rows[0] || null;
    } finally {
        await closeConnection(connection);
    }
}

async function resolveRecipient(teamId, actorUsername, actorEmail) {
    const connection = await getConnection();
    try {
        if (actorUsername || actorEmail) {
            const [rows] = await connection.execute(
                `SELECT tm.user_id
                 FROM team_members tm
                 JOIN registrations r ON r.id = tm.user_id
                 WHERE tm.team_id = ? AND (
                    (? IS NOT NULL AND LOWER(r.github_username) = LOWER(?)) OR
                    (? IS NOT NULL AND LOWER(r.email) = LOWER(?))
                 )
                 LIMIT 1`,
                [teamId, actorUsername || null, actorUsername || null, actorEmail || null, actorEmail || null]
            );
            if (rows.length > 0) {
                return rows[0].user_id;
            }
        }

        const [captainRows] = await connection.execute(
            'SELECT user_id FROM team_members WHERE team_id = ? AND is_captain = 1 ORDER BY user_id LIMIT 1',
            [teamId]
        );
        if (captainRows.length > 0) return captainRows[0].user_id;

        const [viceRows] = await connection.execute(
            'SELECT user_id FROM team_members WHERE team_id = ? AND is_vice_captain = 1 ORDER BY user_id LIMIT 1',
            [teamId]
        );
        if (viceRows.length > 0) return viceRows[0].user_id;

        const [fallbackRows] = await connection.execute(
            'SELECT user_id FROM team_members WHERE team_id = ? ORDER BY user_id LIMIT 1',
            [teamId]
        );
        return fallbackRows.length > 0 ? fallbackRows[0].user_id : null;
    } finally {
        await closeConnection(connection);
    }
}

async function ensureChallengesSeeded() {
    const flattened = flattenCatalog();
    const connection = await getConnection();
    try {
        for (const item of flattened) {
            const [existing] = await connection.execute('SELECT id FROM challenges WHERE name = ? LIMIT 1', [item.key]);
            if (existing.length === 0) {
                await connection.execute(
                    'INSERT INTO challenges (name, description, points, is_hidden) VALUES (?, ?, ?, ?)',
                    [item.key, item.description, item.points, item.isHidden ? 1 : 0]
                );
            } else {
                await connection.execute(
                    'UPDATE challenges SET description = ?, points = ?, is_hidden = ? WHERE name = ?',
                    [item.description, item.points, item.isHidden ? 1 : 0, item.key]
                );
            }
        }
    } finally {
        await closeConnection(connection);
    }
}

async function awardChallenge({ teamId, recipientUserId, challengeKey }) {
    if (!recipientUserId) return false;
    const connection = await getConnection();
    try {
        await connection.beginTransaction();

        // Serialize awards per team so concurrent workers cannot award the same
        // challenge to multiple members before duplicate checks observe each other.
        const [teamRows] = await connection.execute(
            'SELECT id FROM teams WHERE id = ? FOR UPDATE',
            [teamId]
        );
        if (teamRows.length === 0) {
            await connection.rollback();
            return false;
        }

        const [challengeRows] = await connection.execute('SELECT id, points FROM challenges WHERE name = ? LIMIT 1', [challengeKey]);
        if (challengeRows.length === 0) {
            await connection.rollback();
            return false;
        }

        const challengeId = challengeRows[0].id;
        const points = challengeRows[0].points;

        const [existingCompletions] = await connection.execute(
            `SELECT cc.id
                         FROM challenge_completions cc
                         JOIN team_members tm ON tm.user_id = cc.user_id
                         WHERE cc.challenge_id = ?
                             AND tm.team_id = ?
                         LIMIT 1`,
            [challengeId, teamId]
        );
        if (existingCompletions.length > 0) {
            await connection.rollback();
            return false;
        }

        await connection.execute(
            'INSERT INTO challenge_completions (completion_time, challenge_id, user_id) VALUES (NOW(6), ?, ?)',
            [challengeId, recipientUserId]
        );

        await connection.execute(
            'UPDATE team_members SET points = points + ? WHERE team_id = ? AND user_id = ?',
            [points, teamId, recipientUserId]
        );

        await connection.execute(
            `UPDATE teams t
             SET t.total_points = (
                 SELECT COALESCE(SUM(tm.points), 0)
                 FROM team_members tm
                 WHERE tm.team_id = t.id
             )
             WHERE t.id = ?`,
            [teamId]
        );

        await connection.commit();
        return true;
    } catch (err) {
        try {
            await connection.rollback();
        } catch (_) {
            // no-op
        }
        throw err;
    } finally {
        await closeConnection(connection);
    }
}

async function computeRepoStats(repoId) {
    const connection = await getConnection();
    try {
        const [countRows] = await connection.execute(
            `SELECT
                COUNT(*) AS commit_count,
                COUNT(DISTINCT COALESCE(NULLIF(author_email, ''), NULLIF(author_username, ''))) AS contributor_count,
                SUM(CASE WHEN ${STRUCTURED_PREFIXES.map(() => 'LOWER(commit_message) LIKE ?').join(' OR ')} THEN 1 ELSE 0 END) AS structured_count
             FROM commits
             WHERE repo_id = ?`,
            [...STRUCTURED_PREFIXES.map((prefix) => `${prefix}%`), repoId]
        );

        const [docsRows] = await connection.execute(
            `SELECT COUNT(*) AS value
             FROM commits
             WHERE repo_id = ? AND (${DOC_KEYWORDS.map(() => 'LOWER(commit_message) LIKE ?').join(' OR ')})`,
            [repoId, ...DOC_KEYWORDS.map((term) => `%${term}%`)]
        );

        const [testRows] = await connection.execute(
            `SELECT COUNT(*) AS value
             FROM commits
             WHERE repo_id = ? AND (${TEST_KEYWORDS.map(() => 'LOWER(commit_message) LIKE ?').join(' OR ')})`,
            [repoId, ...TEST_KEYWORDS.map((term) => `%${term}%`)]
        );

        const [refactorRows] = await connection.execute(
            `SELECT COUNT(*) AS value
             FROM commit_details
             WHERE repo_id = ?
               AND (${REFACTOR_KEYWORDS.map(() => 'LOWER(message) LIKE ?').join(' OR ')})
               AND (additions - deletions) < 50`,
            [repoId, ...REFACTOR_KEYWORDS.map((term) => `%${term}%`)]
        );

        const [areaRows] = await connection.execute(
            `SELECT commit_message FROM commits
             WHERE repo_id = ? AND (${AREA_KEYWORDS.map(() => 'LOWER(commit_message) LIKE ?').join(' OR ')})`,
            [repoId, ...AREA_KEYWORDS.map((term) => `%${term}%`)]
        );

        const touchedAreas = new Set();
        for (const row of areaRows) {
            const message = normalizeMessage(row.commit_message);
            for (const term of AREA_KEYWORDS) {
                if (message.includes(term)) touchedAreas.add(term);
            }
        }

        return {
            commitCount: countRows[0].commit_count || 0,
            contributorCount: countRows[0].contributor_count || 0,
            structuredCommitCount: countRows[0].structured_count || 0,
            docsCommitCount: docsRows[0].value || 0,
            testCommitCount: testRows[0].value || 0,
            refactorLowNetCount: refactorRows[0].value || 0,
            touchedAreaCount: touchedAreas.size,
        };
    } finally {
        await closeConnection(connection);
    }
}

async function computeActorStats(repoId, actorUsername, actorEmail) {
    const result = {
        structuredCommitCount: 0,
        hasRapidIteration: false,
        mergedPrCount: 0,
        branchCount: 0,
    };

    const connection = await getConnection();
    try {
        if (actorEmail || actorUsername) {
            const email = actorEmail || '';
            const username = actorUsername || '';

            const [structuredRows] = await connection.execute(
                `SELECT COUNT(*) AS value
                 FROM commits
                 WHERE repo_id = ?
                   AND ((? <> '' AND LOWER(author_email) = LOWER(?)) OR (? <> '' AND LOWER(author_username) = LOWER(?)))
                   AND (${STRUCTURED_PREFIXES.map(() => 'LOWER(commit_message) LIKE ?').join(' OR ')})`,
                [repoId, email, email, username, username, ...STRUCTURED_PREFIXES.map((prefix) => `${prefix}%`)]
            );
            result.structuredCommitCount = structuredRows[0].value || 0;

            const [timelineRows] = await connection.execute(
                `SELECT committed_at
                 FROM commit_details
                 WHERE repo_id = ?
                   AND ((? <> '' AND LOWER(author_email) = LOWER(?)) OR (? <> '' AND LOWER(author_username) = LOWER(?)))
                 ORDER BY committed_at ASC`,
                [repoId, email, email, username, username]
            );

            const timestamps = timelineRows.map((row) => Number(row.committed_at)).filter((n) => Number.isFinite(n));
            for (let i = 0; i <= timestamps.length - 5; i += 1) {
                if (timestamps[i + 4] - timestamps[i] <= 6 * 3600) {
                    result.hasRapidIteration = true;
                    break;
                }
            }

            const [mergedRows] = await connection.execute(
                `SELECT COUNT(*) AS value
                 FROM pull_request_events
                 WHERE repo_id = ?
                   AND is_merged = 1
                   AND ((? <> '' AND LOWER(author_email) = LOWER(?)) OR (? <> '' AND LOWER(author_username) = LOWER(?)))`,
                [repoId, email, email, username, username]
            );
            result.mergedPrCount = mergedRows[0].value || 0;

            const [branchRows] = await connection.execute(
                `SELECT COUNT(*) AS value
                 FROM branch_events
                 WHERE repo_id = ?
                   AND ((? <> '' AND LOWER(creator_email) = LOWER(?)) OR (? <> '' AND LOWER(creator_username) = LOWER(?)))`,
                [repoId, email, email, username, username]
            );
            result.branchCount = branchRows[0].value || 0;
        }
    } finally {
        await closeConnection(connection);
    }

    return result;
}

async function fetchRepoCache(repoId) {
    const connection = await getConnection();
    try {
        const [rows] = await connection.execute('SELECT * FROM repo_aggregate_cache WHERE repo_id = ? LIMIT 1', [repoId]);
        if (rows.length === 0) {
            return {
                filePaths: [],
                fileCount: 0,
                hasReadme: false,
                hasLicense: false,
                hasContributing: false,
                hasTestsDir: false,
                readmeText: '',
            };
        }
        const row = rows[0];
        return {
            filePaths: Array.isArray(row.language_counts_json)
                ? row.language_counts_json
                : (() => {
                    try {
                        return JSON.parse(row.language_counts_json || '[]').flatMap((entry) => entry.paths || []);
                    } catch (_) {
                        return [];
                    }
                })(),
            fileCount: row.file_count || 0,
            hasReadme: row.has_readme === 1 || row.has_readme === true || String(row.has_readme) === '1',
            hasLicense: row.has_license === 1 || row.has_license === true || String(row.has_license) === '1',
            hasContributing: row.has_contributing === 1 || row.has_contributing === true || String(row.has_contributing) === '1',
            hasTestsDir: row.has_tests_dir === 1 || row.has_tests_dir === true || String(row.has_tests_dir) === '1',
            readmeText: row.readme_text || '',
        };
    } finally {
        await closeConnection(connection);
    }
}

function buildCommitFacts(payloadCommit, commitDetails, payload) {
    const changedFiles = uniqueStrings([
        ...(payloadCommit.added || []),
        ...(payloadCommit.modified || []),
        ...(payloadCommit.removed || []),
    ]);

    const fileExtensionsTouched = uniqueStrings(
        changedFiles
            .map((path) => {
                const parts = String(path || '').split('.');
                return parts.length > 1 ? parts.pop().toLowerCase() : '';
            })
            .filter(Boolean)
    );

    const topDirs = uniqueStrings(changedFiles.map((file) => (file.includes('/') ? file.split('/')[0] : file)));

    return {
        repoId: payload.repository.id,
        commitSha: payloadCommit.id,
        message: payloadCommit.message || '',
        authorEmail: payloadCommit.author && payloadCommit.author.email ? payloadCommit.author.email : null,
        authorUsername: payloadCommit.author && payloadCommit.author.username ? payloadCommit.author.username : null,
        timestamp: String(toUnixSeconds(payloadCommit.timestamp)),
        changedFiles,
        additions: commitDetails.additions,
        deletions: commitDetails.deletions,
        distinctTopDirs: topDirs,
        fileExtensionsTouched,
    };
}

async function enrichCommitDetails(installationOctokit, payload, commitSha) {
    try {
        const { owner, name } = payload.repository;
        const { data } = await installationOctokit.request('GET /repos/{owner}/{repo}/commits/{ref}', {
            owner: owner.login,
            repo: name,
            ref: commitSha,
            headers: { 'x-github-api-version': '2022-11-28' },
        });

        const changedFiles = (data.files || []).map((f) => f.filename);
        return {
            additions: data.stats ? data.stats.additions || 0 : 0,
            deletions: data.stats ? data.stats.deletions || 0 : 0,
            changedFiles,
        };
    } catch (err) {
        return {
            additions: 0,
            deletions: 0,
            changedFiles: [],
        };
    }
}

async function persistCommitRows(payload, commitFacts, deliveryId) {
    const connection = await getConnection();
    try {
        await connection.execute(
            `INSERT INTO commits (commit_id, installation_id, commit_message, push_id, repo_id, author_email, author_username)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               installation_id = VALUES(installation_id),
               commit_message = VALUES(commit_message),
               push_id = VALUES(push_id),
               repo_id = VALUES(repo_id),
               author_email = VALUES(author_email),
               author_username = VALUES(author_username)`,
            [
                toNumericCommitId(commitFacts.commitSha),
                payload.installation ? payload.installation.id : null,
                commitFacts.message,
                toNumericPushId(payload),
                payload.repository.id,
                commitFacts.authorEmail || '',
                commitFacts.authorUsername || '',
            ]
        );

        await connection.execute(
            `INSERT INTO commit_details (
                repo_id, installation_id, push_id, commit_sha, author_email, author_username,
                committed_at, message, additions, deletions, changed_files_json, top_level_dirs_json, file_extensions_json
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               author_email = VALUES(author_email),
               author_username = VALUES(author_username),
               committed_at = VALUES(committed_at),
               message = VALUES(message),
               additions = VALUES(additions),
               deletions = VALUES(deletions),
               changed_files_json = VALUES(changed_files_json),
               top_level_dirs_json = VALUES(top_level_dirs_json),
               file_extensions_json = VALUES(file_extensions_json)`,
            [
                commitFacts.repoId,
                payload.installation ? payload.installation.id : null,
                toNumericPushId(payload),
                commitFacts.commitSha,
                commitFacts.authorEmail,
                commitFacts.authorUsername,
                parseInt(commitFacts.timestamp, 10) || 0,
                commitFacts.message,
                commitFacts.additions || 0,
                commitFacts.deletions || 0,
                JSON.stringify(commitFacts.changedFiles),
                JSON.stringify(commitFacts.distinctTopDirs),
                JSON.stringify(commitFacts.fileExtensionsTouched),
            ]
        );
    } finally {
        await closeConnection(connection);
    }
}

async function loadNamingConventionStats(repoId) {
    const connection = await getConnection();
    try {
        const [branchRows] = await connection.execute('SELECT branch_name FROM branch_events WHERE repo_id = ?', [repoId]);
        const [commitRows] = await connection.execute('SELECT commit_message FROM commits WHERE repo_id = ?', [repoId]);

        const branchPrefixCounts = BRANCH_PREFIXES.map((prefix) => ({
            key: prefix,
            count: branchRows.filter((row) => String(row.branch_name || '').toLowerCase().startsWith(prefix)).length,
        }));

        const commitPrefixCounts = STRUCTURED_PREFIXES.map((prefix) => ({
            key: prefix,
            count: commitRows.filter((row) => normalizeMessage(row.commit_message).startsWith(prefix)).length,
        }));

        const separatorMap = new Map();
        const caseMap = new Map();
        for (const row of branchRows) {
            const branch = String(row.branch_name || '');
            const sep = inferSeparator(branch);
            separatorMap.set(sep, (separatorMap.get(sep) || 0) + 1);

            const style = inferCaseStyle(branch);
            caseMap.set(style, (caseMap.get(style) || 0) + 1);
        }

        return {
            branchPrefixCounts,
            commitPrefixCounts,
            separatorCounts: [...separatorMap.entries()].map(([key, count]) => ({ key, count })),
            caseCounts: [...caseMap.entries()].map(([key, count]) => ({ key, count })),
        };
    } finally {
        await closeConnection(connection);
    }
}

async function evaluateAndAwardForCategories({
    teamId,
    repoId,
    actorUsername,
    actorEmail,
    repositoryFacts,
    commitFacts,
    branchFacts,
    prFacts,
    categories,
    recipientUserId,
    challengeFilterSet,
}) {
    const repoStats = await computeRepoStats(repoId);
    const actorStats = await computeActorStats(repoId, actorUsername, actorEmail);
    const namingConventionStats = await loadNamingConventionStats(repoId);

    const resolvedRecipientUserId = recipientUserId || await resolveRecipient(teamId, actorUsername, actorEmail);
    if (!resolvedRecipientUserId) return { awarded: 0, attempted: 0 };

    let awarded = 0;
    let attempted = 0;

    for (const category of categories) {
        const categoryChecks = checks[category] || {};
        for (const [challengeKey, checkFn] of Object.entries(categoryChecks)) {
            if (challengeFilterSet && !challengeFilterSet.has(challengeKey)) {
                continue;
            }
            attempted += 1;
            const passed = checkFn({
                repositoryFacts,
                commitFacts,
                branchFacts,
                prFacts,
                repoStats,
                actorStats,
                namingConventionStats,
            });
            if (!passed) continue;
            const didAward = await awardChallenge({ teamId, recipientUserId: resolvedRecipientUserId, challengeKey });
            if (didAward) awarded += 1;
        }
    }

    return { awarded, attempted };
}

function placeholders(count) {
    return Array.from({ length: count }, () => '?').join(',');
}

async function recalculatePointsForTeams(teamIds, existingConnection = null) {
    const normalizedTeamIds = uniqueStrings(
        (teamIds || [])
            .map((id) => Number(id))
            .filter((id) => Number.isFinite(id) && id > 0)
    );

    if (normalizedTeamIds.length === 0) {
        return { teamCount: 0, memberCount: 0 };
    }

    const connection = existingConnection || await getConnection();
    const ownsConnection = !existingConnection;

    try {
        const teamPlaceholders = placeholders(normalizedTeamIds.length);

        await connection.execute(
            `UPDATE team_members tm
             LEFT JOIN (
                 SELECT tm2.team_id, tm2.user_id, COALESCE(SUM(c.points), 0) AS points
                 FROM team_members tm2
                 LEFT JOIN challenge_completions cc ON cc.user_id = tm2.user_id
                 LEFT JOIN challenges c ON c.id = cc.challenge_id
                 WHERE tm2.team_id IN (${teamPlaceholders})
                 GROUP BY tm2.team_id, tm2.user_id
             ) calc ON calc.team_id = tm.team_id AND calc.user_id = tm.user_id
             SET tm.points = COALESCE(calc.points, 0)
             WHERE tm.team_id IN (${teamPlaceholders})`,
            [...normalizedTeamIds, ...normalizedTeamIds]
        );

        await connection.execute(
            `UPDATE teams t
             LEFT JOIN (
                 SELECT tm.team_id, COALESCE(SUM(tm.points), 0) AS total_points
                 FROM team_members tm
                 WHERE tm.team_id IN (${teamPlaceholders})
                 GROUP BY tm.team_id
             ) totals ON totals.team_id = t.id
             SET t.total_points = COALESCE(totals.total_points, 0)
             WHERE t.id IN (${teamPlaceholders})`,
            [...normalizedTeamIds, ...normalizedTeamIds]
        );

        const [memberCountRows] = await connection.execute(
            `SELECT COUNT(*) AS value
             FROM team_members
             WHERE team_id IN (${teamPlaceholders})`,
            normalizedTeamIds
        );

        return {
            teamCount: normalizedTeamIds.length,
            memberCount: Number(memberCountRows[0] && memberCountRows[0].value) || 0,
        };
    } finally {
        if (ownsConnection) {
            await closeConnection(connection);
        }
    }
}

function categoryChallengeKeys(categories) {
    const keys = [];
    for (const category of categories) {
        keys.push(...Object.keys(checks[category] || {}));
    }
    return uniqueStrings(keys);
}

async function loadTeamMembersForAudit(teamId) {
    const connection = await getConnection();
    try {
        const [rows] = await connection.execute(
            `SELECT tm.user_id, r.github_username, r.email
             FROM team_members tm
             JOIN registrations r ON r.id = tm.user_id
             WHERE tm.team_id = ?`,
            [teamId]
        );
        return rows;
    } finally {
        await closeConnection(connection);
    }
}

async function loadPendingChallengesByUser(teamId, userIds, challengeKeys) {
    const emptyResult = {
        byUser: new Map(),
        skippedForEveryone: new Set(),
    };

    if (!teamId || !Array.isArray(userIds) || userIds.length === 0 || !Array.isArray(challengeKeys) || challengeKeys.length === 0) {
        return emptyResult;
    }

    const connection = await getConnection();
    try {
        const [rows] = await connection.execute(
            `SELECT DISTINCT c.name AS challenge_name
             FROM challenge_completions cc
             JOIN challenges c ON c.id = cc.challenge_id
             JOIN team_members tm ON tm.user_id = cc.user_id
             WHERE tm.team_id = ?
               AND c.name IN (${placeholders(challengeKeys.length)})`,
            [teamId, ...challengeKeys]
        );

        const teamCompleted = new Set();
        for (const row of rows) {
            teamCompleted.add(String(row.challenge_name || ''));
        }

        const skippedForEveryone = new Set(challengeKeys.filter((key) => teamCompleted.has(key)));

        const byUser = new Map();
        for (const userId of userIds) {
            const pending = new Set();
            for (const key of challengeKeys) {
                if (skippedForEveryone.has(key)) continue;
                pending.add(key);
            }
            byUser.set(userId, pending);
        }

        return { byUser, skippedForEveryone };
    } finally {
        await closeConnection(connection);
    }
}

async function updateRepoAggregateCache(payload, installationOctokit) {
    const { owner, name, id: repoId } = payload.repository;
    const [repoData, treeResponse, contributorsResponse, branchesResponse] = await Promise.all([
        installationOctokit.request('GET /repos/{owner}/{repo}', {
            owner: owner.login,
            repo: name,
            headers: { 'x-github-api-version': '2022-11-28' },
        }),
        installationOctokit.request('GET /repos/{owner}/{repo}/git/trees/{tree_sha}', {
            owner: owner.login,
            repo: name,
            tree_sha: payload.after || payload.repository.default_branch || 'HEAD',
            recursive: '1',
            headers: { 'x-github-api-version': '2022-11-28' },
        }).catch(() => ({ data: { tree: [] } })),
        installationOctokit.request('GET /repos/{owner}/{repo}/contributors', {
            owner: owner.login,
            repo: name,
            per_page: 100,
            headers: { 'x-github-api-version': '2022-11-28' },
        }).catch(() => ({ data: [] })),
        installationOctokit.request('GET /repos/{owner}/{repo}/branches', {
            owner: owner.login,
            repo: name,
            per_page: 100,
            headers: { 'x-github-api-version': '2022-11-28' },
        }).catch(() => ({ data: [] })),
    ]);

    const treeEntries = (treeResponse.data.tree || []).filter((entry) => entry.type === 'blob');
    const filePaths = treeEntries.map((entry) => entry.path);
    const fileCount = filePaths.length;

    const hasReadme = filePaths.some((path) => path.toLowerCase() === 'readme.md');
    const hasLicense = filePaths.some((path) => path.toLowerCase().startsWith('license'));
    const hasContributing = filePaths.some((path) => path.toLowerCase() === 'contributing.md');
    const hasTestsDir = filePaths.some((path) => /(^|\/)(__tests__|tests)(\/|$)/i.test(path));

    let readmeText = '';
    try {
        const readme = await installationOctokit.request('GET /repos/{owner}/{repo}/readme', {
            owner: owner.login,
            repo: name,
            headers: { 'x-github-api-version': '2022-11-28' },
        });
        readmeText = Buffer.from(readme.data.content || '', 'base64').toString('utf8');
    } catch (_) {
        readmeText = '';
    }

    const languageMap = new Map();
    for (const path of filePaths) {
        const ext = path.includes('.') ? path.split('.').pop().toLowerCase() : '';
        if (!ext) continue;
        if (!languageMap.has(ext)) languageMap.set(ext, { ext, count: 0, paths: [] });
        const item = languageMap.get(ext);
        item.count += 1;
        item.paths.push(path);
    }

    const namingConventionStats = await loadNamingConventionStats(repoId);

    const connection = await getConnection();
    try {
        await connection.execute(
            `INSERT INTO repo_aggregate_cache (
                repo_id, file_count, language_counts_json, branch_naming_conventions_json,
                contributor_count, commit_count, has_readme, has_license, has_contributing, has_tests_dir, readme_text, computed_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(6))
             ON DUPLICATE KEY UPDATE
                file_count = VALUES(file_count),
                language_counts_json = VALUES(language_counts_json),
                branch_naming_conventions_json = VALUES(branch_naming_conventions_json),
                contributor_count = VALUES(contributor_count),
                commit_count = VALUES(commit_count),
                has_readme = VALUES(has_readme),
                has_license = VALUES(has_license),
                has_contributing = VALUES(has_contributing),
                has_tests_dir = VALUES(has_tests_dir),
                readme_text = VALUES(readme_text),
                computed_at = VALUES(computed_at)`,
            [
                repoId,
                fileCount,
                JSON.stringify([...languageMap.values()]),
                JSON.stringify(namingConventionStats),
                (contributorsResponse.data || []).length,
                repoData.data.size || 0,
                hasReadme ? 1 : 0,
                hasLicense ? 1 : 0,
                hasContributing ? 1 : 0,
                hasTestsDir ? 1 : 0,
                readmeText,
            ]
        );
    } finally {
        await closeConnection(connection);
    }

    return {
        repoId,
        filePaths,
        fileCount,
        hasReadme,
        hasLicense,
        hasContributing,
        hasTestsDir,
        readmeText,
        branchNames: (branchesResponse.data || []).map((b) => b.name),
        contributorCount: (contributorsResponse.data || []).length,
    };
}

async function processPushEvent({ app, payload, deliveryId }) {
    const repoFullName = payload.repository.full_name;
    const repoId = payload.repository.id;
    const team = await findTeamByRepoFullName(repoFullName);
    if (!team) return;

    const isNewDelivery = await registerDeliveryIfNew({
        deliveryId,
        eventName: 'push',
        eventAction: null,
        repoId,
    });
    if (!isNewDelivery) return;

    try {
        await ensureChallengesSeeded();
        const installationOctokit = await app.getInstallationOctokit(payload.installation.id);
        const repositoryFacts = await updateRepoAggregateCache(payload, installationOctokit);

        // Some branch creations are only observable via push (created=true + refs/heads/*).
        if (payload.created && String(payload.ref || '').startsWith('refs/heads/')) {
            const branchName = String(payload.ref).replace('refs/heads/', '');
            const actorUsername = payload.sender && payload.sender.login ? payload.sender.login : null;
            await processBranchCreationInternal({
                teamId: team.id,
                repoId,
                payload,
                branchName,
                actorUsername,
                actorEmail: null,
                repositoryFacts,
            });
        }

        for (const payloadCommit of payload.commits || []) {
            const detailed = await enrichCommitDetails(installationOctokit, payload, payloadCommit.id);
            const commitFacts = buildCommitFacts(payloadCommit, detailed, payload);
            if (detailed.changedFiles.length > 0) {
                commitFacts.changedFiles = uniqueStrings([...commitFacts.changedFiles, ...detailed.changedFiles]);
                commitFacts.fileExtensionsTouched = uniqueStrings(
                    commitFacts.changedFiles
                        .map((path) => {
                            const parts = String(path || '').split('.');
                            return parts.length > 1 ? parts.pop().toLowerCase() : '';
                        })
                        .filter(Boolean)
                );
                commitFacts.distinctTopDirs = uniqueStrings(commitFacts.changedFiles.map((file) => (file.includes('/') ? file.split('/')[0] : file)));
            }

            await persistCommitRows(payload, commitFacts, deliveryId);

            await evaluateAndAwardForCategories({
                teamId: team.id,
                repoId,
                actorUsername: commitFacts.authorUsername,
                actorEmail: commitFacts.authorEmail,
                repositoryFacts,
                commitFacts,
                branchFacts: { branchName: '' },
                prFacts: { merged: false },
                categories: ['repository', 'commit', 'file'],
            });
        }

        await markDeliveryComplete(deliveryId, 'processed', null);
    } catch (err) {
        await markDeliveryComplete(deliveryId, 'failed', String(err.message || err));
        throw err;
    }
}

async function processCreateEvent({ payload, deliveryId }) {
    if (payload.ref_type !== 'branch') return;
    const repoFullName = payload.repository.full_name;
    const repoId = payload.repository.id;
    const team = await findTeamByRepoFullName(repoFullName);
    if (!team) return;

    const isNewDelivery = await registerDeliveryIfNew({
        deliveryId,
        eventName: 'create',
        eventAction: null,
        repoId,
    });
    if (!isNewDelivery) return;

    try {
        await ensureChallengesSeeded();

        const actorUsername = payload.sender && payload.sender.login ? payload.sender.login : null;
        const repositoryFacts = await fetchRepoCache(repoId);
        await processBranchCreationInternal({
            teamId: team.id,
            repoId,
            payload,
            branchName: payload.ref,
            actorUsername,
            actorEmail: null,
            repositoryFacts,
        });

        await markDeliveryComplete(deliveryId, 'processed', null);
    } catch (err) {
        await markDeliveryComplete(deliveryId, 'failed', String(err.message || err));
        throw err;
    }
}

async function processBranchCreationInternal({
    teamId,
    repoId,
    payload,
    branchName,
    actorUsername,
    actorEmail,
    repositoryFacts,
}) {
    const connection = await getConnection();
    try {
        await connection.execute(
            `INSERT INTO branch_events (
                repo_id, installation_id, branch_name, creator_username, creator_email, created_at_unix
             ) VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                creator_username = VALUES(creator_username),
                creator_email = VALUES(creator_email),
                created_at_unix = VALUES(created_at_unix)`,
            [
                repoId,
                payload.installation ? payload.installation.id : null,
                branchName,
                actorUsername || null,
                actorEmail || null,
                resolveBranchCreatedAtUnix(payload),
            ]
        );
    } finally {
        await closeConnection(connection);
    }

    const defaultBranchNames = new Set(['main', 'master', 'origin/main', 'origin/master']);
    const nonDefaultBranch = !defaultBranchNames.has(String(branchName || '').toLowerCase());

    const stats = await computeActorStats(repoId, actorUsername, actorEmail);
    const branchFacts = {
        repoId,
        branchName,
        creatorUsername: actorUsername,
        creatorEmail: actorEmail,
        branchCountByCreator: stats.branchCount,
        isFirstNonDefaultBranch: nonDefaultBranch && stats.branchCount === 1,
    };

    await evaluateAndAwardForCategories({
        teamId,
        repoId,
        actorUsername,
        actorEmail,
        repositoryFacts,
        commitFacts: { message: '', changedFiles: [], fileExtensionsTouched: [], distinctTopDirs: [], additions: 0, deletions: 0, timestamp: '0' },
        branchFacts,
        prFacts: { merged: false, additions: 0, deletions: 0, changedFiles: [] },
        categories: ['branch'],
    });
}

async function processPullRequestClosedEvent({ app, payload, deliveryId }) {
    const repoFullName = payload.repository.full_name;
    const repoId = payload.repository.id;
    const team = await findTeamByRepoFullName(repoFullName);
    if (!team) return;

    const isNewDelivery = await registerDeliveryIfNew({
        deliveryId,
        eventName: 'pull_request',
        eventAction: 'closed',
        repoId,
    });
    if (!isNewDelivery) return;

    try {
        await ensureChallengesSeeded();

        const actorUsername = payload.pull_request && payload.pull_request.user ? payload.pull_request.user.login : null;
        const installationOctokit = await app.getInstallationOctokit(payload.installation.id);

        const filesResponse = await installationOctokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}/files', {
            owner: payload.repository.owner.login,
            repo: payload.repository.name,
            pull_number: payload.pull_request.number,
            per_page: 100,
            headers: { 'x-github-api-version': '2022-11-28' },
        }).catch(() => ({ data: [] }));

        const changedFiles = (filesResponse.data || []).map((f) => f.filename);
        const additions = payload.pull_request.additions || 0;
        const deletions = payload.pull_request.deletions || 0;
        const openedAt = toUnixSeconds(payload.pull_request.created_at);
        const mergedAt = payload.pull_request.merged_at ? toUnixSeconds(payload.pull_request.merged_at) : 0;
        const closedAt = payload.pull_request.closed_at ? toUnixSeconds(payload.pull_request.closed_at) : 0;

        const connection = await getConnection();
        try {
            await connection.execute(
                `INSERT INTO pull_request_events (
                    repo_id, installation_id, pr_number, author_username, author_email, opened_at, closed_at, merged_at, is_merged,
                    additions, deletions, changed_files_json
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                    author_username = VALUES(author_username),
                    author_email = VALUES(author_email),
                    opened_at = VALUES(opened_at),
                    closed_at = VALUES(closed_at),
                    merged_at = VALUES(merged_at),
                    is_merged = VALUES(is_merged),
                    additions = VALUES(additions),
                    deletions = VALUES(deletions),
                    changed_files_json = VALUES(changed_files_json)`,
                [
                    repoId,
                    payload.installation ? payload.installation.id : null,
                    payload.pull_request.number,
                    actorUsername,
                    null,
                    openedAt,
                    closedAt,
                    mergedAt || null,
                    payload.pull_request.merged ? 1 : 0,
                    additions,
                    deletions,
                    JSON.stringify(changedFiles),
                ]
            );
        } finally {
            await closeConnection(connection);
        }

        const prFacts = {
            repoId,
            prNumber: payload.pull_request.number,
            authorUsername: actorUsername,
            merged: Boolean(payload.pull_request.merged),
            openedAt: String(openedAt || 0),
            mergedAt: mergedAt ? String(mergedAt) : null,
            changedFiles,
            additions,
            deletions,
        };

        const repositoryFacts = await fetchRepoCache(repoId);

        await evaluateAndAwardForCategories({
            teamId: team.id,
            repoId,
            actorUsername,
            actorEmail: null,
            repositoryFacts,
            commitFacts: { message: '', changedFiles: [], fileExtensionsTouched: [], distinctTopDirs: [], additions: 0, deletions: 0, timestamp: '0' },
            branchFacts: { branchName: '' },
            prFacts,
            categories: ['commit'],
        });

        await markDeliveryComplete(deliveryId, 'processed', null);
    } catch (err) {
        await markDeliveryComplete(deliveryId, 'failed', String(err.message || err));
        throw err;
    }
}

async function runScheduledHighLoadChecks(app) {
    const connection = await getConnection();
    let runId = null;
    try {
        await connection.execute(
            `INSERT INTO scheduler_runs (job_name, started_at, status, details)
             VALUES ('missed_challenge_audit', NOW(6), 'running', 'Checking repositories for missed challenge completions (pending only)')`
        );
        const [idRows] = await connection.execute('SELECT LAST_INSERT_ID() AS id');
        runId = idRows[0].id;
    } finally {
        await closeConnection(connection);
    }

    try {
        const connection2 = await getConnection();
        let teams = [];
        try {
            const [rows] = await connection2.execute('SELECT id, github_repo, installation_id FROM teams WHERE github_repo IS NOT NULL AND installation_id IS NOT NULL');
            teams = rows;
        } finally {
            await closeConnection(connection2);
        }

        let teamCount = 0;
        let userChecks = 0;
        let challengesSkippedForEveryone = 0;
        let challengesAttempted = 0;
        let challengesAwarded = 0;
        let teamsSkipped = 0;
        let installationAccessErrors = 0;
        let recalculatedMembers = 0;
        let recalculatedTeams = 0;

        for (const team of teams) {
            teamCount += 1;
            const repoPath = String(team.github_repo || '').split('/').slice(-2).join('/');
            const [owner, repo] = repoPath.split('/');
            if (!owner || !repo) continue;

            try {
                const installationOctokit = await app.getInstallationOctokit(team.installation_id);
                const payloadLike = {
                    repository: {
                        owner: { login: owner },
                        name: repo,
                        id: null,
                        default_branch: 'main',
                        full_name: `${owner}/${repo}`,
                    },
                    installation: { id: team.installation_id },
                    after: 'HEAD',
                };

                const repoMeta = await installationOctokit.request('GET /repos/{owner}/{repo}', {
                    owner,
                    repo,
                    headers: { 'x-github-api-version': '2022-11-28' },
                });
                payloadLike.repository.id = repoMeta.data.id;
                payloadLike.repository.default_branch = repoMeta.data.default_branch;

                const repositoryFacts = await updateRepoAggregateCache(payloadLike, installationOctokit);
                const categories = ['repository', 'file', 'branch'];
                const challengeKeys = categoryChallengeKeys(categories);

                const teamMembers = await loadTeamMembersForAudit(team.id);
                const userIds = teamMembers.map((m) => m.user_id).filter(Boolean);
                if (userIds.length === 0) continue;

                const pendingResult = await loadPendingChallengesByUser(team.id, userIds, challengeKeys);
                challengesSkippedForEveryone += pendingResult.skippedForEveryone.size;

                for (const member of teamMembers) {
                    const pendingKeys = pendingResult.byUser.get(member.user_id) || new Set();
                    if (pendingKeys.size === 0) continue;

                    userChecks += 1;
                    const outcome = await evaluateAndAwardForCategories({
                        teamId: team.id,
                        repoId: payloadLike.repository.id,
                        actorUsername: member.github_username || null,
                        actorEmail: member.email || null,
                        recipientUserId: member.user_id,
                        challengeFilterSet: pendingKeys,
                        repositoryFacts,
                        commitFacts: { message: '', changedFiles: [], fileExtensionsTouched: [], distinctTopDirs: [], additions: 0, deletions: 0, timestamp: '0' },
                        branchFacts: { branchName: '' },
                        prFacts: { merged: false, additions: 0, deletions: 0, changedFiles: [] },
                        categories,
                    });
                    challengesAttempted += outcome.attempted;
                    challengesAwarded += outcome.awarded;
                }
            } catch (err) {
                teamsSkipped += 1;
                const isInstallationAccessError = Number(err && err.status) === 404
                    && String(err && err.request && err.request.url || '').includes('/app/installations/');
                if (isInstallationAccessError) {
                    installationAccessErrors += 1;
                }
                console.error(
                    `Scheduled audit skipped team ${team.id} (${owner}/${repo}) due to ${isInstallationAccessError ? 'invalid or revoked installation' : 'processing error'}:`,
                    String(err && err.message || err)
                );
                continue;
            }
        }

        const teamIdsForRecalc = teams.map((team) => Number(team.id)).filter((id) => Number.isFinite(id) && id > 0);
        const recalculation = await recalculatePointsForTeams(teamIdsForRecalc);
        recalculatedMembers = recalculation.memberCount;
        recalculatedTeams = recalculation.teamCount;

        if (runId) {
            const finishConn = await getConnection();
            try {
                await finishConn.execute(
                    'UPDATE scheduler_runs SET finished_at = NOW(6), status = ?, details = ? WHERE id = ?',
                    [
                        'success',
                        `Audited ${teamCount} team(s), evaluated ${userChecks} user scope(s), attempted ${challengesAttempted} pending checks, awarded ${challengesAwarded}, skipped ${challengesSkippedForEveryone} challenge(s) already completed by a teammate, skipped ${teamsSkipped} team(s) due to processing errors (${installationAccessErrors} installation access error(s)); recalculated points for ${recalculatedMembers} member(s) across ${recalculatedTeams} team(s).`,
                        runId,
                    ]
                );
            } finally {
                await closeConnection(finishConn);
            }
        }
    } catch (err) {
        if (runId) {
            const errorConn = await getConnection();
            try {
                await errorConn.execute(
                    'UPDATE scheduler_runs SET finished_at = NOW(6), status = ?, details = ? WHERE id = ?',
                    ['failed', String(err.message || err), runId]
                );
            } finally {
                await closeConnection(errorConn);
            }
        }
        throw err;
    }
}

async function runChallengeDuplicateCleanupJob() {
    const setupConnection = await getConnection();
    let runId = null;
    try {
        await setupConnection.execute(
            `INSERT INTO scheduler_runs (job_name, started_at, status, details)
             VALUES ('challenge_duplicate_cleanup', NOW(6), 'running', 'Removing duplicate team challenge completions (keeping earliest completion)')`
        );
        const [idRows] = await setupConnection.execute('SELECT LAST_INSERT_ID() AS id');
        runId = idRows[0].id;
    } finally {
        await closeConnection(setupConnection);
    }

    const connection = await getConnection();
    try {
        await connection.beginTransaction();

        const [rows] = await connection.execute(
            `SELECT
                cc.id,
                cc.user_id,
                cc.challenge_id,
                cc.completion_time,
                tm.team_id,
                c.points
             FROM challenge_completions cc
             JOIN team_members tm ON tm.user_id = cc.user_id
             JOIN challenges c ON c.id = cc.challenge_id
             ORDER BY tm.team_id ASC, cc.challenge_id ASC, cc.completion_time ASC, cc.id ASC`
        );

        const seen = new Set();
        const duplicateIds = [];
        const affectedTeams = new Set();

        for (const row of rows) {
            const teamId = Number(row.team_id);
            const challengeId = Number(row.challenge_id);
            const userId = Number(row.user_id);
            const points = Number(row.points) || 0;
            const key = `${teamId}:${challengeId}`;

            if (!seen.has(key)) {
                seen.add(key);
                continue;
            }

            duplicateIds.push(Number(row.id));
            affectedTeams.add(teamId);
        }

        if (duplicateIds.length > 0) {
            const batchSize = 500;
            for (let i = 0; i < duplicateIds.length; i += batchSize) {
                const batch = duplicateIds.slice(i, i + batchSize);
                await connection.execute(
                    `DELETE FROM challenge_completions WHERE id IN (${placeholders(batch.length)})`,
                    batch
                );
            }
        }

        const [teamRows] = await connection.execute('SELECT id FROM teams');
        const teamIdsForRecalc = teamRows.map((team) => Number(team.id)).filter((id) => Number.isFinite(id) && id > 0);
        const recalculation = await recalculatePointsForTeams(teamIdsForRecalc, connection);

        await connection.commit();

        if (runId) {
            await connection.execute(
                `UPDATE scheduler_runs
                 SET finished_at = NOW(6), status = ?, details = ?
                 WHERE id = ?`,
                [
                    'success',
                    `Removed ${duplicateIds.length} duplicate completion(s) across ${affectedTeams.size} team(s); earliest completion per team/challenge retained; recalculated points for ${recalculation.memberCount} member(s) across ${recalculation.teamCount} team(s).`,
                    runId,
                ]
            );
        }

        return {
            removedCount: duplicateIds.length,
            affectedTeamCount: affectedTeams.size,
            recalculatedMemberCount: recalculation.memberCount,
            recalculatedTeamCount: recalculation.teamCount,
        };
    } catch (err) {
        try {
            await connection.rollback();
        } catch (_) {
            // no-op
        }

        if (runId) {
            try {
                await connection.execute(
                    `UPDATE scheduler_runs
                     SET finished_at = NOW(6), status = ?, details = ?
                     WHERE id = ?`,
                    ['failed', String(err.message || err), runId]
                );
            } catch (_) {
                // no-op
            }
        }

        throw err;
    } finally {
        await closeConnection(connection);
    }
}

async function runPointsRecalculationJob() {
    const setupConnection = await getConnection();
    let runId = null;
    try {
        await setupConnection.execute(
            `INSERT INTO scheduler_runs (job_name, started_at, status, details)
             VALUES ('points_recalculation', NOW(6), 'running', 'Recalculating team and member points from challenge completions')`
        );
        const [idRows] = await setupConnection.execute('SELECT LAST_INSERT_ID() AS id');
        runId = idRows[0].id;
    } finally {
        await closeConnection(setupConnection);
    }

    const connection = await getConnection();
    try {
        await connection.beginTransaction();

        const [teamRows] = await connection.execute('SELECT id FROM teams');
        const teamIds = teamRows.map((team) => Number(team.id)).filter((id) => Number.isFinite(id) && id > 0);
        const result = await recalculatePointsForTeams(teamIds, connection);

        await connection.commit();

        if (runId) {
            await connection.execute(
                `UPDATE scheduler_runs
                 SET finished_at = NOW(6), status = ?, details = ?
                 WHERE id = ?`,
                [
                    'success',
                    `Recalculated points for ${result.memberCount} member(s) across ${result.teamCount} team(s).`,
                    runId,
                ]
            );
        }

        return {
            recalculatedMemberCount: result.memberCount,
            recalculatedTeamCount: result.teamCount,
        };
    } catch (err) {
        try {
            await connection.rollback();
        } catch (_) {
            // no-op
        }

        if (runId) {
            try {
                await connection.execute(
                    `UPDATE scheduler_runs
                     SET finished_at = NOW(6), status = ?, details = ?
                     WHERE id = ?`,
                    ['failed', String(err.message || err), runId]
                );
            } catch (_) {
                // no-op
            }
        }

        throw err;
    } finally {
        await closeConnection(connection);
    }
}

module.exports = {
    catalog,
    ensureSupplementalSchema,
    ensureChallengesSeeded,
    processPushEvent,
    processCreateEvent,
    processPullRequestClosedEvent,
    runScheduledHighLoadChecks,
    runChallengeDuplicateCleanupJob,
    runPointsRecalculationJob,
};
