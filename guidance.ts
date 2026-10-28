/**
 * System-guidance text builder for the todowrite plugin.
 *
 * Pure function so the wording is testable without a host; the hook wiring
 * lives in index.ts.
 */

/**
 * One-line nudge appended to the system instructions: makes the model create
 * the todo list BEFORE executing the first step of multi-step work, which the
 * tool description alone did not reliably achieve.
 */
export function buildGuidance(writeToolName: string, readToolName?: string): string {
  let text =
    `Todo tracking: when planning multi-step work, call \`${writeToolName}\` with your full initial task list BEFORE executing the first step. ` +
    `Update the list at meaningful checkpoints — when a major task finishes or the plan changes — and mark all tasks completed when the work is done; ` +
    `batching minor updates is fine.`;
  if (readToolName) {
    text += ` Call \`${readToolName}\` to recover the list if it is no longer visible, for example after context compaction.`;
  }
  return text;
}
