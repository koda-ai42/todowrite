/**
 * Pure todo-list logic for the todowrite plugin.
 *
 * Validation and storage access are separated from the plugin wiring and the
 * storage is injectable, so tests need neither network nor a running host.
 */

export type TodoStatus = "pending" | "in_progress" | "completed";
export type TodoPriority = "high" | "medium" | "low";

export interface Todo {
  content: string;
  status: TodoStatus;
  priority: TodoPriority;
}

/** Minimal storage surface used here; ctx.storage satisfies it. */
export interface TodoStorage {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
}

const STATUSES: readonly string[] = ["pending", "in_progress", "completed"];
const PRIORITIES: readonly string[] = ["high", "medium", "low"];

/** Storage key holding the session's todo list. */
export function storageKey(sessionID: string): string {
  return `todo/${sessionID}`;
}

export type ValidateResult = { ok: true; todos: Todo[] } | { ok: false; errors: string[] };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Validate a raw tool input against the V1-compatible todo schema.
 * Returns every error at once; on success the todos are normalized to the
 * three known fields only.
 */
export function validateTodos(input: unknown, maxTodos: number): ValidateResult {
  const errors: string[] = [];
  if (!isPlainObject(input)) return { ok: false, errors: ["input: must be an object"] };

  const raw = input.todos;
  if (!Array.isArray(raw)) return { ok: false, errors: ["todos: must be an array"] };
  if (raw.length > maxTodos) {
    return { ok: false, errors: [`todos: too many items (${raw.length}, max ${maxTodos})`] };
  }

  const todos: Todo[] = [];
  raw.forEach((item, i) => {
    if (!isPlainObject(item)) {
      errors.push(`todos[${i}]: must be an object`);
      return;
    }
    let { content, status, priority } = item;
    if (typeof content === "string" && content.trim().length > 0) content = content.trim();
    else errors.push(`todos[${i}].content: must be a non-empty string`);
    if (typeof status !== "string" || !STATUSES.includes(status)) {
      errors.push(`todos[${i}].status: must be one of ${STATUSES.join(", ")}`);
    }
    if (typeof priority !== "string" || !PRIORITIES.includes(priority)) {
      errors.push(`todos[${i}].priority: must be one of ${PRIORITIES.join(", ")}`);
    }
    if (typeof content === "string" && typeof status === "string" && typeof priority === "string") {
      todos.push({ content, status: status as TodoStatus, priority: priority as TodoPriority });
    }
  });

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, todos };
}

/** Persist the full list for a session (full replacement semantics). */
export async function saveTodos(
  storage: TodoStorage,
  sessionID: string,
  todos: readonly Todo[],
): Promise<void> {
  await storage.set(storageKey(sessionID), todos);
}

/** Tool output shape for the read tool, identical to todowrite's echo. */
export function formatTodos(todos: readonly Todo[]): string {
  return JSON.stringify({ todos });
}

export type LoadResult = { ok: true; todos: Todo[] } | { ok: false; errors: string[] };

/**
 * Validate a raw stored value against the todo schema (read side of the RPC).
 * Returns every error at once; on success the todos are normalized to the
 * three known fields only.
 */
export function normalizeTodos(raw: unknown): LoadResult {
  const errors: string[] = [];
  if (!Array.isArray(raw)) return { ok: false, errors: ["stored value: must be an array of todos"] };

  const todos: Todo[] = [];
  raw.forEach((item, i) => {
    if (!isPlainObject(item)) {
      errors.push(`todos[${i}]: must be an object`);
      return;
    }
    let { content, status, priority } = item;
    if (typeof content === "string" && content.trim().length > 0) content = content.trim();
    else errors.push(`todos[${i}].content: must be a non-empty string`);
    if (typeof status !== "string" || !STATUSES.includes(status)) {
      errors.push(`todos[${i}].status: must be one of ${STATUSES.join(", ")}`);
    }
    if (typeof priority !== "string" || !PRIORITIES.includes(priority)) {
      errors.push(`todos[${i}].priority: must be one of ${PRIORITIES.join(", ")}`);
    }
    if (typeof content === "string" && typeof status === "string" && typeof priority === "string") {
      todos.push({ content, status: status as TodoStatus, priority: priority as TodoPriority });
    }
  });

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, todos };
}

/**
 * Read the session's stored list. A missing entry is an empty list; anything
 * stored that does not validate is reported as errors.
 */
export async function loadTodos(storage: TodoStorage, sessionID: string): Promise<LoadResult> {
  const raw = await storage.get(storageKey(sessionID));
  if (raw === undefined || raw === null) return { ok: true, todos: [] };
  return normalizeTodos(raw);
}
