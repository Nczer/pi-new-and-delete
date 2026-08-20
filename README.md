# New & Delete

A pi extension that adds a `/nn` command to start a fresh session and archive the current session file as a backup in one step.

## Usage

Once installed, type `/nn` in any pi session to:

1. Confirm archiving of the current session.
2. If the session has a custom name (set via `/name`), confirm a second time to prevent accidental loss of intentionally named sessions.
3. Move the session file to `.nn.bak` in the same session directory and start a new, clean session.

## Backup behavior

There is a single rotating backup slot per session directory: `<session-dir>/.nn.bak`.

- First `/nn`: the current session file becomes `.nn.bak`.
- Subsequent `/nn` runs: the current session becomes the new `.nn.bak`, and the previous backup is deleted (replaced).

The backup file is plain JSONL in the same format as session files. Restore it by renaming it to `*.jsonl` (e.g. `mv .nn.bak my-session.jsonl`) and resuming it, or inspect it with any text editor. It deliberately does not end in `.jsonl` so pi's session list does not pick it up.

## Why

Useful when you want to quickly discard the current conversation and start over — similar to closing a terminal tab and opening a new one, but without leaving pi, and with a safety net: the previous session is always one file away.

## Installation

Copy this extension into your pi extensions directory (~/.pi/agent/extensions/).
