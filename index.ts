/**
 * todowrite — OpenCode plugin.
 *
 * Restores the V1-style todo tools for OpenCode V2:
 * - `todowrite`: the model passes the complete todo list on every call, the
 *   plugin validates it, stores it per session via ctx.storage, and echoes it
 *   back.
 * - `todoread`: takes no arguments and returns the session's stored list, so
 *   the model can recover it after context compaction. Disable with
 *   `readEnabled: false`.
 *
 * The runtime import surface is Node built-ins only: @opencode/plugin is
 * imported type-only, so a deployed copy needs no node_modules (the host
 * injects the real modules).
 */
import type { Plugin } from "@opencode/plugin";
import { loadConfig } from "./config.ts";
import { buildGuidance } from "./guidance.ts";
import { formatTodos, loadTodos, saveTodos, validateTodos } from "./todos.ts";

function log(level: "info" | "warn", message: string): void {
  // Plugin stdout is captured by the host service log; keep it short and redacted.
  console.log(`[todowrite] ${level}: ${message}`);
}

export const setup: Plugin.Plugin["setup"] = async (ctx) => {
  const result = await loadConfig(new URL("./todowrite.json", import.meta.url), ctx.options);
  if (!result.ok) {
    log("warn", `disabled: ${result.errors.join("; ")}`);
    return;
  }
  const config = result.config;
  const toolOptions = config.codemode ? { codemode: true } : { codemode: false };
  log(
    "info",
    `enabled (tools ${config.writeToolName}${config.readEnabled ? `, ${config.readToolName}` : ""}; maxTodos ${config.maxTodos}, codemode ${config.codemode}, guidance ${config.systemGuidance})`,
  );

  // Nudge the model to plan with the write tool before executing; the tool
  // description alone did not reliably achieve up-front list creation.
  const guidanceHook = config.systemGuidance
    ? await ctx.session.hook("context", (event) => {
        event.system.push({
          type: "text",
          text: buildGuidance(config.writeToolName, config.readEnabled ? config.readToolName : undefined),
        });
      })
    : undefined;

  const registration = await ctx.tool.transform((editor) => {
    editor.add({
      name: config.writeToolName,
      description: config.description,
      // codemode:false keeps tools native definitions (callable by plain
      // name like V1); true would expose them only via Code Mode as tools.<name>.
      options: toolOptions,
      input: {
        type: "object",
        properties: {
          todos: {
            type: "array",
            description: "The complete todo list. Replaces the stored list on every call.",
            items: {
              type: "object",
              properties: {
                content: { type: "string", description: "Task description" },
                status: {
                  type: "string",
                  enum: ["pending", "in_progress", "completed"],
                  description: "Current task status",
                },
                priority: {
                  type: "string",
                  enum: ["high", "medium", "low"],
                  description: "Task priority",
                },
              },
              required: ["content", "status", "priority"],
              additionalProperties: false,
            },
          },
        },
        required: ["todos"],
        additionalProperties: false,
      },
      execute: async (input, context) => {
        const validated = validateTodos(input, config.maxTodos);
        if (!validated.ok) {
          throw new Error(`${config.writeToolName}: ${validated.errors.join("; ")}`);
        }
        await saveTodos(ctx.storage, context.sessionID, validated.todos);
        return { content: JSON.stringify({ todos: validated.todos }) };
      },
    });

    if (config.readEnabled) {
      editor.add({
        name: config.readToolName,
        description: config.readDescription,
        options: toolOptions,
        input: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        execute: async (_input, context) => {
          const read = await loadTodos(ctx.storage, context.sessionID);
          if (!read.ok) {
            throw new Error(
              `${config.readToolName}: stored todo list is invalid (${read.errors.join("; ")}); call ${config.writeToolName} with the full list to repair it`,
            );
          }
          return { content: formatTodos(read.todos) };
        },
      });
    }
  });

  return async () => {
    await registration.dispose();
    await guidanceHook?.dispose();
  };
};

const plugin: Plugin.Plugin = { id: "todowrite", setup };
export default plugin;
