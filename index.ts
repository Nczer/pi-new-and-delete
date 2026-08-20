/**
 * New & Delete extension
 *
 * Adds /nn command: starts a new session and archives the current session file
 * as a single rotating backup (.nn.bak) in the same session directory.
 *
 * Running /nn again replaces the previous backup with the then-current session.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import * as fs from "node:fs/promises";
import * as path from "node:path";

// Single rotating backup slot per session directory.
// Not *.jsonl so pi's session discovery (findMostRecentSession / session list) ignores it.
const BAK_NAME = ".nn.bak";

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
}
