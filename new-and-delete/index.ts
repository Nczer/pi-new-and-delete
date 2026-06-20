/**
 * New & Delete extension
 *
 * Adds /nn command: starts a new session and deletes the current session file.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import * as fs from "node:fs/promises";

export default function nnExtension(pi: ExtensionAPI) {
  pi.registerCommand("nn", {
    description: "Start a new session and delete the current one",
    handler: async (_args, ctx) => {
      const sessionFile = ctx.sessionManager.getSessionFile();

      if (!sessionFile) {
        ctx.ui.notify("No session file to delete (ephemeral session)", "info");
        return;
      }

      // Confirm before deleting
      const ok = await ctx.ui.confirm(
        "Delete current session?",
        `This will start a new session and permanently delete:\n${sessionFile}`,
      );

      if (!ok) {
        ctx.ui.notify("Cancelled", "info");
        return;
      }

      // Second confirmation for sessions with a custom name
      const sessionName = ctx.sessionManager.getSessionName();
      if (sessionName) {
        const ok2 = await ctx.ui.confirm(
          "Delete named session?",
          `This session has a custom name ("${sessionName}").\nAre you sure you want to delete it?`,
        );

        if (!ok2) {
          ctx.ui.notify("Cancelled", "info");
          return;
        }
      }

      // Start a fresh session first, then delete the old file inside the callback
      // to avoid any race with the session manager's teardown/flush logic.
      const fileToDelete = sessionFile;
      await ctx.newSession({
        withSession: async (newCtx) => {
          try {
            await fs.unlink(fileToDelete);
            newCtx.ui.notify("New session started, old session deleted", "info");
          } catch {
            newCtx.ui.notify("New session started, but old file could not be deleted", "warning");
          }
        },
      });
    },
  });
}
