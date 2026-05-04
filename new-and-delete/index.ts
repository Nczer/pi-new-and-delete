/**
 * New & Delete extension
 *
 * Adds /nn command: starts a new session and deletes the current session file.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import * as fs from "node:fs";

export default function (pi: ExtensionAPI) {
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

      // Delete the current session file before switching
      try {
        fs.unlinkSync(sessionFile);
      } catch (err) {
        ctx.ui.notify(`Failed to delete session: ${err}`, "error");
        return;
      }

      // Start a fresh session
      await ctx.newSession({
        withSession: (ctx) => {
          ctx.ui.notify("New session started, old session deleted", "success");
        },
      });
    },
  });
}
