# Contributing

Thank you for your interest in improving ehacksObserver.

## Purpose
This project is maintained as a reliable, read-only GitHub App for hackathon scoring and activity tracking. Contributions should prioritize correctness, stability, and clarity.

## Local Setup
1. Install dependencies:
	- npm ci
2. Start local development:
	- npm run dev

## Testing Requirements
Before opening a pull request, run:
- npm run test:unit
- npm run test:e2e

Or run the full suite:
- npm test

## Pull Request Guidelines
- Keep each pull request focused on one change or problem.
- Include a short summary of why the change is needed.
- Add or update tests when behavior changes.
- Avoid unrelated refactors in the same pull request.

## Commit Message Style
Use Conventional Commits where possible.

Examples:
- feat: add challenge deduplication guard
- fix: handle missing pushed_at fallback
- test: add regression coverage for branch naming checks

## Security and Secrets
- Do not commit credentials, tokens, or private keys.
- Keep runtime secrets in environment variables.
- If you identify a security issue, report it privately to maintainers.

## Questions
If requirements are unclear, open an issue with context, expected behavior, and any relevant logs.
