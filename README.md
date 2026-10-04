# New & Delete

A pi extension that adds `/nn` (start a fresh session, archiving the current one as a backup) and `/nnr` (restore that backup).

## Usage

Once installed, type `/nn` in any pi session to:

1. Confirm archiving of the current session.
2. If the session has a custom name (set via `/name`), confirm a second time to prevent accidental loss of intentionally named sessions.
3. Move the session file to `.nn.bak` in the same session directory and start a new, clean session.

Type `/nnr` to undo it: the backup is restored as a live session and the session you were just in takes its place in the backup slot.

## Restoring: `/nnr`

`/nnr` swaps the backup slot with the current session:

1. Confirm — the dialog shows both paths.
2. `.nn.bak` is renamed back to pi's own session-file name, derived from its header entry (`<timestamp>_<id>.jsonl`), so it sorts and reads like any other session in `/resume`. If that name is already taken, a `-1`, `-2`, … suffix is added.
3. The session you were in is moved into the now-empty `.nn.bak` slot.

Because it is a swap, `/nnr` is its own inverse: run it again and you are back where you started. Nothing is deleted.

`/nnr` reports and does nothing when there is nothing to restore: no `.nn.bak` in this session directory, an ephemeral session, or a backup whose header cannot be read (in that case rename the file to `*.jsonl` by hand). If the current session file *is* `.nn.bak` — possible only if you renamed it yourself — `/nnr` refuses rather than swapping onto itself.

## Backup behavior

There is a single rotating backup slot per session directory: `<session-dir>/.nn.bak`.

- First `/nn`: the current session file becomes `.nn.bak`.
- Subsequent `/nn` runs: the current session becomes the new `.nn.bak`, and the previous backup is deleted (replaced).

The backup file is plain JSONL in the same format as session files. `/nnr` is the normal way back; you can also rename it to `*.jsonl` (e.g. `mv .nn.bak my-session.jsonl`) and resume it, or inspect it with any text editor. It deliberately does not end in `.jsonl` so pi's session list does not pick it up.

Only the most recent `/nn` is recoverable — the slot holds one session, and each `/nn` replaces it.

## Why

Useful when you want to quickly discard the current conversation and start over — similar to closing a terminal tab and opening a new one, but without leaving pi, and with a safety net: the previous session is always one file away.

## Installation

Copy this extension into your pi extensions directory (~/.pi/agent/extensions/).
