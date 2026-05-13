# Contributing to UnDocker

Thanks for helping improve UnDocker.

## Scope

Keep changes **focused** on the Unraid Docker / Compose experience. Avoid unrelated refactors, new dependencies without a clear need, or copying large third-party trees into the repo.

## Workflow

1. **Fork** [romwil/undockerui](https://github.com/romwil/undockerui) and create a branch from `main`.
2. **Develop** in `web/` (see [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)).
3. Run **`npm run lint`** and **`npm run build`** from `web/` before pushing.
4. Open a **pull request** with a short description of behavior changes and any Unraid-version assumptions.

## Commits

Use clear, imperative subject lines (e.g. “Fix compose path validation for symlinks”). Link issues with `Fixes #12` when applicable.

## Security

If you find a vulnerability, please **do not** open a public issue with exploit details. Open a **private security advisory** on GitHub or contact the maintainer directly. See [docs/SECURITY.md](docs/SECURITY.md) for the intended threat model.

## Reference material

Historical GraphQL exploration may live in a local `reference/` folder; it is **gitignored**. The repo keeps a single snapshot at [docs/graphql-schema.snapshot.graphql](docs/graphql-schema.snapshot.graphql) for documentation only—verify behavior against your Unraid version.
