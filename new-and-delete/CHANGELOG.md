# Changelog

## 1.2 — Fix session deletion race condition

### Bug fixes

- **Delete session file after new session starts.** Moved the file deletion inside the `withSession` callback to avoid a race with the session manager's teardown/flush logic. Switched from sync `fs.unlinkSync()` to async `await fs.unlink()`.
- **Non-fatal error handling.** If the old session file can't be deleted, a warning is shown instead of aborting the entire operation.

### Other changes

- Named the default export (`nnExtension`) for better debugging/tooling support.
- Renamed inner callback param to `newCtx` to avoid shadowing the outer `ctx`.

Ditto

## 1.1 — Double confirmation for named sessions

### New features

- **Second confirmation for named sessions**. When deleting a session that has a custom name (set via `/name`), a second confirmation dialog appears asking "Delete named session?" to prevent accidental deletion of intentionally named sessions. Unnamed sessions still require only the single confirmation.
