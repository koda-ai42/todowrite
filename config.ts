/**
 * Declarative configuration loading and fail-closed validation for todowrite.
 *
 * The JSON file next to index.ts is declarative only. All validation happens
 * here; an invalid config disables the plugin with a clear error instead of
 * partially applying.
 */
import { readFile } from "node:fs/promises";

export interface PluginConfig {
  schemaVersion: number;
  /** Effective tool name of the write tool registered with the model. */
  writeToolName: string;
  /** Write tool description shown to the model. */
  description: string;
  /** Maximum number of items accepted in one todo list. */
  maxTodos: number;
  /**
   * When true the tools are only reachable through Code Mode (`tools.<name>`).
   * Default false: exposed directly as native tools, like V1's todowrite.
   */
  codemode: boolean;
  /** Effective tool name of the read tool. */
  readToolName: string;
  /** Read tool description shown to the model. */
  readDescription: string;
  /** When false the read tool is not registered at all. */
  readEnabled: boolean;
  /**
   * When true (default) a short system-guidance line is appended to model
   * requests telling the model to plan with the write tool before executing.
   */
  systemGuidance: boolean;
}

/** Default description for the read tool; used when readDescription is absent. */
export const DEFAULT_READ_DESCRIPTION =
  "Read the stored todo list for the current session (maintained by the todowrite tool). Takes no arguments and returns the full list as JSON ({ \"todos\": [...] }), or { \"todos\": [] } when nothing is stored. Use it to recover the task list after context compaction.";

/**
 * Built-in V2 tool names a plugin tool must not shadow: a later registration
 * silently overrides an earlier one with the same effective name, so a
 * collision would silently replace core functionality.
 */
export const RESERVED_TOOL_NAMES: readonly string[] = [
  "execute",
  "read",
  "write",
  "edit",
  "patch",
  "glob",
  "grep",
  "shell",
  "question",
  "skill",
  "subagent",
  "webfetch",
  "websearch",
];

export type LoadResult = { ok: true; config: PluginConfig } | { ok: false; errors: string[] };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Validate a tool-name field; returns the name or pushes errors. */
function checkToolName(
  raw: Record<string, unknown>,
  field: string,
  fallback: string | undefined,
  errors: string[],
): string | undefined {
  const present = raw[field] !== undefined;
  const value = present ? raw[field] : fallback;
  if (typeof value !== "string" || !/^[a-zA-Z0-9_-]+$/.test(value)) {
    errors.push(`${field}: must be a non-empty string of letters, digits, _ or -`);
    return undefined;
  }
  if (RESERVED_TOOL_NAMES.includes(value)) {
    errors.push(`${field}: '${value}' collides with a built-in tool`);
    return undefined;
  }
  return value;
}

/** Validate raw parsed JSON; returns all errors at once, never a partial config. */
export function validateConfig(raw: unknown): { config?: PluginConfig; errors: string[] } {
  const errors: string[] = [];
  if (!isPlainObject(raw)) return { errors: ["config: must be a JSON object"] };

  if (raw.schemaVersion !== 1) {
    errors.push(`schemaVersion: must be 1, got ${JSON.stringify(raw.schemaVersion)}`);
  }
  const writeToolName = checkToolName(raw, "writeToolName", undefined, errors);
  let description: string | undefined;
  if (typeof raw.description === "string" && raw.description.trim().length > 0) {
    description = raw.description.trim();
  } else errors.push("description: must be a non-empty string");
  let maxTodos: number | undefined;
  if (typeof raw.maxTodos === "number" && Number.isInteger(raw.maxTodos) && raw.maxTodos >= 1 && raw.maxTodos <= 200) {
    maxTodos = raw.maxTodos;
  } else errors.push("maxTodos: must be an integer between 1 and 200");
  let codemode = false;
  if (raw.codemode !== undefined) {
    if (typeof raw.codemode === "boolean") codemode = raw.codemode;
    else errors.push("codemode: must be a boolean");
  }
  const readToolName = checkToolName(raw, "readToolName", "todoread", errors);
  let readDescription = DEFAULT_READ_DESCRIPTION;
  if (raw.readDescription !== undefined) {
    if (typeof raw.readDescription === "string" && raw.readDescription.trim().length > 0) {
      readDescription = raw.readDescription.trim();
    } else errors.push("readDescription: must be a non-empty string");
  }
  let readEnabled = true;
  if (raw.readEnabled !== undefined) {
    if (typeof raw.readEnabled === "boolean") readEnabled = raw.readEnabled;
    else errors.push("readEnabled: must be a boolean");
  }
  let systemGuidance = true;
  if (raw.systemGuidance !== undefined) {
    if (typeof raw.systemGuidance === "boolean") systemGuidance = raw.systemGuidance;
    else errors.push("systemGuidance: must be a boolean");
  }

  // Same effective name would silently override one tool with the other.
  if (readEnabled && writeToolName && readToolName && writeToolName === readToolName) {
    errors.push("readToolName: must differ from writeToolName");
  }

  if (errors.length > 0 || !writeToolName || !readToolName || !description || maxTodos === undefined) {
    return { errors };
  }
  return {
    config: {
      schemaVersion: 1,
      writeToolName,
      description,
      maxTodos,
      codemode,
      readToolName,
      readDescription,
      readEnabled,
      systemGuidance,
    },
    errors: [],
  };
}

/** Load and validate the config file; options from the plugin entry may override. */
export async function loadConfig(url: URL, options?: unknown): Promise<LoadResult> {
  let text: string;
  try {
    text = await readFile(url, "utf8");
  } catch (e) {
    return { ok: false, errors: [`cannot read config: ${(e as Error).message}`] };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { ok: false, errors: [`invalid JSON: ${(e as Error).message}`] };
  }
  const merged = isPlainObject(raw) && isPlainObject(options) ? { ...raw, ...options } : raw;
  const { config, errors } = validateConfig(merged);
  if (errors.length > 0 || !config) return { ok: false, errors };
  return { ok: true, config };
}
