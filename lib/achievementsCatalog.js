const hiddenChallengeKeys = new Set([
    'growing_codebase',
    'team_player',
    'final_hour_sprint',
    'documentation_champion',
    'polyglot_builder',
    'feature_builder',
    'bug_slayer',
    'rapid_iteration',
    'feature_flow',
    'ticket_tracker',
    'project_starter',
    'documented_intent',
    'setup_wizard',
    'dependency_manager',
]);

const catalog = {
    repository: {
        typed_architect: { description: 'Detected 10+ TypeScript (.ts) files in the repository.', points: 220 },
        pythonista: { description: 'Detected 10+ Python (.py) files in the repository.', points: 160 },
        js_craftsman: { description: 'Detected 10+ JavaScript (.js) files in the repository.', points: 150 },
        jvm_builder: { description: 'Detected 10+ Java (.java) files in the repository.', points: 150 },
        gopher: { description: 'Detected 10+ Go (.go) files in the repository.', points: 140 },
        systems_rustacean: { description: 'Detected 10+ Rust (.rs) files in the repository.', points: 200 },
        cpp_builder: { description: 'Detected 10+ C/C++ source or header files in the repository.', points: 140 },
        csharp_dev: { description: 'Detected 10+ C# (.cs) files in the repository.', points: 140 },
        rubyist: { description: 'Detected 10+ Ruby (.rb) files in the repository.', points: 120 },
        php_builder: { description: 'Detected 10+ PHP (.php) files in the repository.', points: 100 },
        polyglot_builder: { description: 'Detected multiple programming language extensions across the repository.', points: 180 },
        growing_codebase: { description: 'Repository contains more than 100 files, indicating meaningful scope.', points: 210 },
        team_player: { description: 'Repository has 2+ contributors, indicating team collaboration.', points: 150 },
        commit_milestone: { description: 'Repository has reached 200+ commits.', points: 210 },
        final_hour_sprint: { description: 'A commit was made within the final 2 hours of the event.', points: 90 },
        documentation_champion: { description: 'Multiple documentation-focused commits detected across the repo.', points: 160 },
        quality_guardian: { description: 'Multiple test-related commits detected across the repo.', points: 170 },
        refactor_champion: { description: '5+ refactor commits with low net additions detected.', points: 180 },
        balanced_builder: { description: 'Commits touch at least two of docs, frontend, backend, or data.', points: 150 },
    },
    commit: {
        feature_builder: { description: 'Commit message follows the feat: convention.', points: 160 },
        bug_slayer: { description: 'Commit message indicates a bug fix (contains fix).', points: 120 },
        refactor_specialist: { description: 'Commit message indicates a refactor (contains refactor).', points: 130 },
        breaking_changes: { description: 'Commit includes a BREAKING CHANGE declaration.', points: 200 },
        commit_stylist: { description: 'Commit history follows Conventional Commits formatting consistently.', points: 100 },
        milestone_contributor: { description: 'Contributor has 10+ structured commits.', points: 140 },
        rapid_iteration: { description: 'Contributor made 5+ commits within a 6-hour window.', points: 110 },
        merge_maker: { description: 'A pull request authored by the user was merged.', points: 100 },
        integration_expert: { description: 'Contributor has 10+ merged pull requests.', points: 180 },
        large_scale_contributor: { description: 'Pull request or commit adds 500+ changed lines.', points: 220 },
        focused_contributor: { description: 'Pull request or commit focuses on a single directory or area.', points: 100 },
        lightning_merge: { description: 'Pull request merged within 2 hours of opening.', points: 140 },
    },
    branch: {
        branch_creator: { description: "User created the repository's first branch.", points: 70 },
        feature_flow: { description: 'Branch name matches the feature/* pattern.', points: 90 },
        hotfix_hero: { description: 'Branch name matches the hotfix/* pattern.', points: 90 },
        release_engineer: { description: 'Branch name matches the release/* pattern.', points: 120 },
        ticket_tracker: { description: 'Branch name includes a ticket reference (e.g., JIRA-123).', points: 80 },
        naming_master: { description: "Branch follows the repository's naming conventions.", points: 80 },
        branch_strategist: { description: 'User created 5+ branches in the repository.', points: 130 },
    },
    file: {
        project_starter: { description: 'Repository contains a README.md file.', points: 50 },
        licensed_and_legit: { description: 'Repository contains a LICENSE file.', points: 60 },
        contributor_friendly: { description: 'Repository contains a CONTRIBUTING.md file.', points: 60 },
        documented_intent: { description: 'README contains onboarding or Getting Started instructions.', points: 70 },
        demo_ready: { description: 'README documents a demo or pitch flow.', points: 120 },
        setup_wizard: { description: 'README contains install and run commands for local setup.', points: 110 },
        test_ready: { description: 'Repository includes a /tests directory.', points: 130 },
        test_contributor: { description: 'A commit modifies files under /tests or __tests__.', points: 120 },
        documentation_advocate: { description: 'A commit modifies documentation files.', points: 80 },
        dependency_manager: { description: 'A commit modifies package.json or equivalent dependency manifest.', points: 110 },
        container_captain: { description: 'A commit modifies a Dockerfile.', points: 130 },
        full_stack_commit: { description: 'A commit modifies 3+ file types, spanning multiple layers.', points: 150 },
        heavy_lifter: { description: 'A commit adds 500+ lines of code.', points: 170 },
        code_cleaner: { description: 'A commit removes 300+ lines of code.', points: 160 },
        smoke_test: { description: 'A commit modifies any file under /tests or /__tests__.', points: 100 },
    },
};

function flattenCatalog() {
    const flat = [];
    for (const [category, entries] of Object.entries(catalog)) {
        for (const [key, def] of Object.entries(entries)) {
            flat.push({
                key,
                category,
                description: def.description,
                points: def.points,
                isHidden: hiddenChallengeKeys.has(key),
            });
        }
    }
    return flat;
}

module.exports = {
    catalog,
    hiddenChallengeKeys,
    flattenCatalog,
};
