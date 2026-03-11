const DEFAULT_EVENT_END_TIMESTAMP = 1772982000;

function normalizeArray(value) {
    return Array.isArray(value) ? value : [];
}

function normalizedMessage(input) {
    return String(input || '').toLowerCase();
}

function endsWithAny(path, suffixes) {
    return suffixes.some((suffix) => path.toLowerCase().endsWith(suffix));
}

function countByExtension(paths, suffixes) {
    return normalizeArray(paths).filter((path) => endsWithAny(path, suffixes)).length;
}

function distinctLanguageExtensionCount(paths) {
    const allowed = new Set(['ts', 'py', 'js', 'java', 'go', 'rs', 'c', 'cpp', 'h', 'hpp', 'cs', 'rb', 'php']);
    const seen = new Set();
    for (const path of normalizeArray(paths)) {
        const parts = path.toLowerCase().split('.');
        if (parts.length < 2) continue;
        const ext = parts.pop();
        if (allowed.has(ext)) seen.add(ext);
    }
    return seen.size;
}

function eventEndTimestamp() {
    const parsed = parseInt(process.env.EVENT_END_TIMESTAMP || '', 10);
    return Number.isFinite(parsed) ? parsed : DEFAULT_EVENT_END_TIMESTAMP;
}

function hoursBetween(startTs, endTs) {
    return (endTs - startTs) / 3600;
}

function inferredBranchConventionStrength(stats = {}) {
    const branchPrefixMax = Math.max(0, ...(stats.branchPrefixCounts || []).map((x) => x.count || 0));
    const commitPrefixMax = Math.max(0, ...(stats.commitPrefixCounts || []).map((x) => x.count || 0));
    return { branchPrefixMax, commitPrefixMax };
}

function hasRepeatedSeparatorOrCase(stats = {}) {
    const separatorMax = Math.max(0, ...(stats.separatorCounts || []).map((x) => x.count || 0));
    const caseMax = Math.max(0, ...(stats.caseCounts || []).map((x) => x.count || 0));
    return separatorMax >= 2 || caseMax >= 2;
}

const checks = {
    repository: {
        typed_architect: ({ repositoryFacts }) => countByExtension(repositoryFacts.filePaths, ['.ts']) >= 10,
        pythonista: ({ repositoryFacts }) => countByExtension(repositoryFacts.filePaths, ['.py']) >= 10,
        js_craftsman: ({ repositoryFacts }) => countByExtension(repositoryFacts.filePaths, ['.js']) >= 10,
        jvm_builder: ({ repositoryFacts }) => countByExtension(repositoryFacts.filePaths, ['.java']) >= 10,
        gopher: ({ repositoryFacts }) => countByExtension(repositoryFacts.filePaths, ['.go']) >= 10,
        systems_rustacean: ({ repositoryFacts }) => countByExtension(repositoryFacts.filePaths, ['.rs']) >= 10,
        cpp_builder: ({ repositoryFacts }) => countByExtension(repositoryFacts.filePaths, ['.c', '.cpp', '.h', '.hpp']) >= 10,
        csharp_dev: ({ repositoryFacts }) => countByExtension(repositoryFacts.filePaths, ['.cs']) >= 10,
        rubyist: ({ repositoryFacts }) => countByExtension(repositoryFacts.filePaths, ['.rb']) >= 10,
        php_builder: ({ repositoryFacts }) => countByExtension(repositoryFacts.filePaths, ['.php']) >= 10,
        polyglot_builder: ({ repositoryFacts }) => distinctLanguageExtensionCount(repositoryFacts.filePaths) >= 5,
        growing_codebase: ({ repositoryFacts }) => repositoryFacts.fileCount > 100,
        team_player: ({ repoStats }) => (repoStats.contributorCount || 0) >= 2,
        commit_milestone: ({ repoStats }) => (repoStats.commitCount || 0) >= 200,
        final_hour_sprint: ({ commitFacts }) => {
            if (!commitFacts || !commitFacts.timestamp) return false;
            const commitTimestamp = parseInt(commitFacts.timestamp, 10);
            if (!Number.isFinite(commitTimestamp)) return false;
            const endTs = eventEndTimestamp();
            return commitTimestamp >= endTs - 2 * 3600;
        },
        documentation_champion: ({ repoStats }) => (repoStats.docsCommitCount || 0) >= 5,
        quality_guardian: ({ repoStats }) => (repoStats.testCommitCount || 0) >= 5,
        refactor_champion: ({ repoStats }) => (repoStats.refactorLowNetCount || 0) >= 5,
        balanced_builder: ({ repoStats }) => (repoStats.touchedAreaCount || 0) >= 2,
    },
    commit: {
        feature_builder: ({ commitFacts }) => normalizedMessage(commitFacts.message).startsWith('feat:'),
        bug_slayer: ({ commitFacts }) => normalizedMessage(commitFacts.message).includes('fix'),
        refactor_specialist: ({ commitFacts }) => normalizedMessage(commitFacts.message).includes('refactor'),
        breaking_changes: ({ commitFacts }) => String(commitFacts.message || '').includes('BREAKING CHANGE'),
        commit_stylist: ({ repoStats }) => {
            const total = repoStats.commitCount || 0;
            const structured = repoStats.structuredCommitCount || 0;
            return total > 0 && structured / total >= 0.8;
        },
        milestone_contributor: ({ actorStats }) => (actorStats.structuredCommitCount || 0) >= 10,
        rapid_iteration: ({ actorStats }) => Boolean(actorStats.hasRapidIteration),
        merge_maker: ({ actorStats }) => (actorStats.mergedPrCount || 0) >= 1,
        integration_expert: ({ actorStats }) => (actorStats.mergedPrCount || 0) >= 10,
        large_scale_contributor: ({ commitFacts, prFacts }) => {
            const commitDelta = (commitFacts.additions || 0) + (commitFacts.deletions || 0);
            const prDelta = (prFacts.additions || 0) + (prFacts.deletions || 0);
            return commitDelta >= 500 || prDelta >= 500;
        },
        focused_contributor: ({ commitFacts, prFacts }) => {
            const topDirs = normalizeArray(commitFacts.distinctTopDirs);
            if (topDirs.length === 1) return true;
            const changedFiles = normalizeArray(prFacts.changedFiles);
            if (changedFiles.length === 0) return false;
            const roots = new Set(changedFiles.map((file) => file.split('/')[0] || file));
            return roots.size === 1;
        },
        lightning_merge: ({ prFacts }) => {
            if (!prFacts.openedAt || !prFacts.mergedAt) return false;
            const opened = parseInt(prFacts.openedAt, 10);
            const merged = parseInt(prFacts.mergedAt, 10);
            return Number.isFinite(opened) && Number.isFinite(merged) && hoursBetween(opened, merged) <= 2;
        },
    },
    branch: {
        branch_creator: ({ branchFacts }) => Boolean(branchFacts.isFirstNonDefaultBranch),
        feature_flow: ({ branchFacts }) => String(branchFacts.branchName || '').toLowerCase().startsWith('feature/'),
        hotfix_hero: ({ branchFacts }) => String(branchFacts.branchName || '').toLowerCase().startsWith('hotfix/'),
        release_engineer: ({ branchFacts }) => String(branchFacts.branchName || '').toLowerCase().startsWith('release/'),
        ticket_tracker: ({ branchFacts }) => /[A-Z]+-\d+/.test(String(branchFacts.branchName || '')),
        naming_master: ({ namingConventionStats }) => {
            const { branchPrefixMax, commitPrefixMax } = inferredBranchConventionStrength(namingConventionStats);
            const hasHybridPair = branchPrefixMax >= 2 && commitPrefixMax >= 2;
            const hasStrongBranchSignal = branchPrefixMax >= 3;
            return hasHybridPair || (hasStrongBranchSignal && hasRepeatedSeparatorOrCase(namingConventionStats));
        },
        branch_strategist: ({ actorStats }) => (actorStats.branchCount || 0) >= 5,
    },
    file: {
        project_starter: ({ repositoryFacts }) => Boolean(repositoryFacts.hasReadme),
        licensed_and_legit: ({ repositoryFacts }) => Boolean(repositoryFacts.hasLicense),
        contributor_friendly: ({ repositoryFacts }) => Boolean(repositoryFacts.hasContributing),
        documented_intent: ({ repositoryFacts }) => /(getting started|onboarding|quick start|setup)/i.test(repositoryFacts.readmeText || ''),
        demo_ready: ({ repositoryFacts }) => /(demo|pitch)/i.test(repositoryFacts.readmeText || ''),
        setup_wizard: ({ repositoryFacts }) => /(npm install|yarn install|pnpm install|npm run|yarn |pnpm |docker compose|docker run|make )/i.test(repositoryFacts.readmeText || ''),
        test_ready: ({ repositoryFacts }) => Boolean(repositoryFacts.hasTestsDir),
        test_contributor: ({ commitFacts }) => normalizeArray(commitFacts.changedFiles).some((f) => /(^|\/)(__tests__|tests)(\/|$)/i.test(f)),
        documentation_advocate: ({ commitFacts }) => normalizeArray(commitFacts.changedFiles).some((f) => /(^docs\/)|\.md$/i.test(f)),
        dependency_manager: ({ commitFacts }) => normalizeArray(commitFacts.changedFiles).some((f) => /(^|\/)(package\.json|package-lock\.json|yarn\.lock|pnpm-lock\.yaml|requirements\.txt|pom\.xml|build\.gradle|Cargo\.toml|go\.mod)$/i.test(f)),
        container_captain: ({ commitFacts }) => normalizeArray(commitFacts.changedFiles).some((f) => /(^|\/)Dockerfile$/i.test(f)),
        full_stack_commit: ({ commitFacts }) => new Set(normalizeArray(commitFacts.fileExtensionsTouched)).size >= 3,
        heavy_lifter: ({ commitFacts }) => (commitFacts.additions || 0) >= 500,
        code_cleaner: ({ commitFacts }) => (commitFacts.deletions || 0) >= 300,
        smoke_test: ({ commitFacts }) => normalizeArray(commitFacts.changedFiles).some((f) => /(^|\/)(__tests__|tests)(\/|$)/i.test(f)),
    },
};

module.exports = {
    checks,
    DEFAULT_EVENT_END_TIMESTAMP,
};
