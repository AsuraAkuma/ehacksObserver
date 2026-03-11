const dotenv = require('dotenv');
const fs = require('fs');
const { App } = require('octokit');
const { getConnection, closeConnection } = require('../db-connect');
const {
    ensureSupplementalSchema,
    ensureChallengesSeeded,
    runScheduledHighLoadChecks,
} = require('../lib/pointsEngine');

dotenv.config();

function toUnixSeconds(iso) {
    const value = Math.floor(new Date(iso).getTime() / 1000);
    return Number.isFinite(value) ? value : 0;
}

function toNumericCommitId(sha) {
    if (!sha) return 0;
    try {
        const raw = BigInt(`0x${sha.slice(0, 12)}`);
        return Number(raw % 2147483647n) + 1;
    } catch (_) {
        return 0;
    }
}

function toNumericPushId(sha) {
    if (!sha) return 0;
    try {
        const raw = BigInt(`0x${sha.slice(0, 12)}`);
        return Number(raw % 2147483647n) + 1;
    } catch (_) {
        return 0;
    }
}

async function fetchTeamsWithRepos() {
    const connection = await getConnection();
    try {
        const [rows] = await connection.execute(
            'SELECT id, github_repo, installation_id FROM teams WHERE github_repo IS NOT NULL AND installation_id IS NOT NULL'
        );
        return rows;
    } finally {
        await closeConnection(connection);
    }
}

async function upsertBranchEvent({ repoId, installationId, branchName, creatorUsername, createdAtUnix }) {
    const connection = await getConnection();
    try {
        await connection.execute(
            `INSERT INTO branch_events (
                repo_id, installation_id, branch_name, creator_username, creator_email, created_at_unix
             ) VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                creator_username = VALUES(creator_username),
                created_at_unix = VALUES(created_at_unix)`,
            [repoId, installationId, branchName, creatorUsername || null, null, createdAtUnix]
        );
    } finally {
        await closeConnection(connection);
    }
}

async function upsertCommit({ repoId, installationId, commit }) {
    const sha = commit.sha;
    const message = commit.commit && commit.commit.message ? commit.commit.message : '';
    const authorEmail = commit.commit && commit.commit.author ? commit.commit.author.email || '' : '';
    const authorUsername = commit.author ? commit.author.login || '' : '';
    const committedAt = commit.commit && commit.commit.author ? toUnixSeconds(commit.commit.author.date) : 0;

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
                toNumericCommitId(sha),
                installationId,
                message,
                toNumericPushId(sha),
                repoId,
                authorEmail,
                authorUsername,
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
                message = VALUES(message)`,
            [
                repoId,
                installationId,
                toNumericPushId(sha),
                sha,
                authorEmail || null,
                authorUsername || null,
                committedAt,
                message,
                0,
                0,
                JSON.stringify([]),
                JSON.stringify([]),
                JSON.stringify([]),
            ]
        );
    } finally {
        await closeConnection(connection);
    }
}

async function upsertPrEvent({ repoId, installationId, pr }) {
    const connection = await getConnection();
    try {
        await connection.execute(
            `INSERT INTO pull_request_events (
                repo_id, installation_id, pr_number, author_username, author_email,
                opened_at, closed_at, merged_at, is_merged, additions, deletions, changed_files_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                author_username = VALUES(author_username),
                opened_at = VALUES(opened_at),
                closed_at = VALUES(closed_at),
                merged_at = VALUES(merged_at),
                is_merged = VALUES(is_merged),
                additions = VALUES(additions),
                deletions = VALUES(deletions),
                changed_files_json = VALUES(changed_files_json)`,
            [
                repoId,
                installationId,
                pr.number,
                pr.user ? pr.user.login || null : null,
                null,
                toUnixSeconds(pr.created_at),
                pr.closed_at ? toUnixSeconds(pr.closed_at) : null,
                pr.merged_at ? toUnixSeconds(pr.merged_at) : null,
                pr.merged_at ? 1 : 0,
                pr.additions || 0,
                pr.deletions || 0,
                JSON.stringify([]),
            ]
        );
    } finally {
        await closeConnection(connection);
    }
}

async function main() {
    const appId = process.env.APP_ID;
    const webhookSecret = process.env.WEBHOOK_SECRET;
    const privateKeyPath = process.env.PRIVATE_KEY_PATH;
    const privateKey = fs.readFileSync(privateKeyPath, 'utf8');

    const app = new App({
        appId,
        privateKey,
        webhooks: {
            secret: webhookSecret,
        },
    });

    await ensureSupplementalSchema();
    await ensureChallengesSeeded();

    const teams = await fetchTeamsWithRepos();
    for (const team of teams) {
        const repoPath = String(team.github_repo || '').split('/').slice(-2).join('/');
        const [owner, repo] = repoPath.split('/');
        if (!owner || !repo) continue;

        const installationOctokit = await app.getInstallationOctokit(team.installation_id);

        const repoResponse = await installationOctokit.request('GET /repos/{owner}/{repo}', {
            owner,
            repo,
            headers: { 'x-github-api-version': '2022-11-28' },
        });
        const repoId = repoResponse.data.id;

        console.log(`Backfilling ${owner}/${repo} (repo_id=${repoId})`);

        const branchesResp = await installationOctokit.request('GET /repos/{owner}/{repo}/branches', {
            owner,
            repo,
            per_page: 100,
            headers: { 'x-github-api-version': '2022-11-28' },
        }).catch(() => ({ data: [] }));

        for (const branch of branchesResp.data || []) {
            await upsertBranchEvent({
                repoId,
                installationId: team.installation_id,
                branchName: branch.name,
                creatorUsername: null,
                createdAtUnix: Math.floor(Date.now() / 1000),
            });
        }

        const commitsResp = await installationOctokit.request('GET /repos/{owner}/{repo}/commits', {
            owner,
            repo,
            per_page: 100,
            headers: { 'x-github-api-version': '2022-11-28' },
        }).catch(() => ({ data: [] }));

        for (const commit of commitsResp.data || []) {
            await upsertCommit({
                repoId,
                installationId: team.installation_id,
                commit,
            });
        }

        const pullsResp = await installationOctokit.request('GET /repos/{owner}/{repo}/pulls', {
            owner,
            repo,
            state: 'closed',
            per_page: 100,
            headers: { 'x-github-api-version': '2022-11-28' },
        }).catch(() => ({ data: [] }));

        for (const pr of pullsResp.data || []) {
            await upsertPrEvent({
                repoId,
                installationId: team.installation_id,
                pr,
            });
        }
    }

    await runScheduledHighLoadChecks(app);
    console.log('Backfill completed successfully.');
}

main()
    .then(() => {
        process.exit(0);
    })
    .catch((error) => {
        console.error('Backfill failed:', error);
        process.exit(1);
    });
