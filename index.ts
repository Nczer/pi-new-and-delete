/**
 * New & Delete extension
 *
 * /nn  — starts a new session and archives the current session file as a single
 *        rotating backup (.nn.bak) in the same session directory.
 * /nnr — restores that backup: swaps it with the current session, so /nnr is its
 *        own inverse and nothing is ever discarded.
 *
 * Running /nn again replaces the previous backup with the then-current session.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import * as fs from "node:fs/promises";
import * as path from "node:path";

// Single rotating backup slot per session directory.
// Not *.jsonl so pi's session discovery (findMostRecentSession / session list) ignores it.
const BAK_NAME = ".nn.bak";

/**
 * Rebuild pi's own session file name from the backup's header entry, so the
 * restored session sorts and reads like any other session in /resume:
 *   {"type":"session","id":"<id>","timestamp":"2026-10-04T08:50:27.608Z",...}
 *   -> 2026-10-04T08-50-27-608Z_<id>.jsonl
 */
function sessionFileNameFromHeader(firstLine: string): string | null {
  let header: unknown;
  try {
    header = JSON.parse(firstLine);
  } catch {
    return null;
  }
  if (!header || typeof header !== "object") return null;
  const h = header as { type?: unknown; id?: unknown; timestamp?: unknown };
  if (h.type !== "session" || typeof h.id !== "string" || typeof h.timestamp !== "string") {
    return null;
  }
  return `${h.timestamp.replace(/[:.]/g, "-")}_${h.id}.jsonl`;
}

export default function nnExtension(pi: ExtensionAPI) {
  pi.registerCommand("nn", {
    description: "Start a new session; archive the current one as a backup (replaces previous backup)",
    handler: async (_args, ctx) => {
      const sessionFile = ctx.sessionManager.getSessionFile();

      if (!sessionFile) {
        ctx.ui.notify("No session file to back up (ephemeral session)", "info");
        return;
      }

      const bakPath = path.join(path.dirname(sessionFile), BAK_NAME);

      // Confirm before archiving
      const ok = await ctx.ui.confirm(
        "Back up current session?",
        `This will start a new session and move the current session to:\n${bakPath}\nAny previous backup will be deleted.`,
      );

      if (!ok) {
        ctx.ui.notify("Cancelled", "info");
        return;
      }

      // Second confirmation for sessions with a custom name
      const sessionName = ctx.sessionManager.getSessionName();
      if (sessionName) {
        const ok2 = await ctx.ui.confirm(
          "Back up named session?",
          `This session has a custom name ("${sessionName}").\nIts previous backup will be replaced. Continue?`,
        );

        if (!ok2) {
          ctx.ui.notify("Cancelled", "info");
          return;
        }
      }

      const hadBackup = await fs
        .access(bakPath)
        .then(() => true, () => false);

      // Start a fresh session first, then move the old file inside the callback
      // to avoid any race with the session manager's teardown/flush logic.
      const fileToMove = sessionFile;
      const result = await ctx.newSession({
        withSession: async (newCtx) => {
          try {
            // POSIX rename overwrites the target, but unlink first for portability.
            await fs.unlink(bakPath).catch((e) => {
              if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
            });
            await fs.rename(fileToMove, bakPath);
            newCtx.ui.notify(
              hadBackup
                ? "New session started; previous backup replaced"
                : "New session started; session backed up",
              "info",
            );
          } catch (e) {
            // ENOENT means the old file is already gone — the backup slot will be
            // empty, which is still a valid end state.
            if ((e as NodeJS.ErrnoException).code === "ENOENT") {
              newCtx.ui.notify("New session started; old session already gone (nothing backed up)", "info");
            } else {
              newCtx.ui.notify(
                `New session started; could not back up old file: ${e instanceof Error ? e.message : String(e)}`,
                "warning",
              );
            }
          }
        },
      });

      // Cancellation happens before teardown, so ctx is still valid here.
      if (result.cancelled) {
        ctx.ui.notify("New session was cancelled; old session kept", "info");
      }
    },
  });

  pi.registerCommand("nnr", {
    description: "Restore the .nn.bak backup, swapping it with the current session (run again to swap back)",
    handler: async (_args, ctx) => {
      const sessionFile = ctx.sessionManager.getSessionFile();

      if (!sessionFile) {
        ctx.ui.notify("No session to restore into (ephemeral session)", "info");
        return;
      }

      const sessionDir = path.dirname(sessionFile);
      const bakPath = path.join(sessionDir, BAK_NAME);

      // Defensive: a session switched onto the backup file itself has nowhere to swap.
      if (path.resolve(sessionFile) === path.resolve(bakPath)) {
        ctx.ui.notify(
          `This session is the ${BAK_NAME} file itself; rename it to *.jsonl before restoring`,
          "warning",
        );
        return;
      }

      let bakContent: string;
      try {
        bakContent = await fs.readFile(bakPath, "utf8");
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === "ENOENT") {
          ctx.ui.notify(`No backup to restore (${BAK_NAME} is empty)`, "info");
        } else {
          ctx.ui.notify(`Could not read ${BAK_NAME}: ${e instanceof Error ? e.message : String(e)}`, "warning");
        }
        return;
      }

      const name = sessionFileNameFromHeader(bakContent.slice(0, bakContent.indexOf("\n")));
      if (!name) {
        ctx.ui.notify(
          `${BAK_NAME} header is unreadable; restore aborted. Rename it to *.jsonl by hand to recover it.`,
          "warning",
        );
        return;
      }

      // Keep pi's name, but never clobber an existing session file.
      let targetPath = path.join(sessionDir, name);
      if (targetPath === path.resolve(sessionFile)) {
        ctx.ui.notify("The backup belongs to this session; nothing to swap", "info");
        return;
      }
      if (await fs.access(targetPath).then(() => true, () => false)) {
        const base = name.slice(0, -".jsonl".length);
        let i = 1;
        while (await fs.access(path.join(sessionDir, `${base}-${i}.jsonl`)).then(() => true, () => false)) {
          i++;
        }
        targetPath = path.join(sessionDir, `${base}-${i}.jsonl`);
      }

      const ok = await ctx.ui.confirm(
        "Restore backed-up session?",
        `Restore:\n  ${bakPath}\n  -> ${targetPath}\n\nCurrent session moves to:\n  ${bakPath}\n\nRun /nnr again to swap back.`,
      );
      if (!ok) {
        ctx.ui.notify("Cancelled", "info");
        return;
      }

      // Free the slot and give the backup a real session name before switching,
      // so the live session is never the backup file itself.
      try {
        await fs.rename(bakPath, targetPath);
      } catch (e) {
        ctx.ui.notify(`Could not restore backup: ${e instanceof Error ? e.message : String(e)}`, "warning");
        return;
      }

      // Move the outgoing session into the slot only after the old session manager
      // has been torn down, so nothing appends to a file we have already renamed.
      const outgoing = sessionFile;
      const result = await ctx.switchSession(targetPath, {
        withSession: async (newCtx) => {
          try {
            await fs.rename(outgoing, bakPath);
            newCtx.ui.notify(`Restored ${path.basename(targetPath)}; previous session moved to ${BAK_NAME}`, "info");
          } catch (e) {
            newCtx.ui.notify(
              `Restored, but the previous session was left at ${outgoing} (${e instanceof Error ? e.message : String(e)})`,
              "warning",
            );
          }
        },
      });

      // Cancellation happens before teardown, so the switch never happened: undo the rename.
      if (result.cancelled) {
        await fs.rename(targetPath, bakPath).catch(() => {});
        ctx.ui.notify("Restore cancelled; backup put back", "info");
      }
    },
  });
}
