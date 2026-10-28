import { test } from "node:test";
import assert from "node:assert/strict";
import { formatTodos, loadTodos, normalizeTodos, saveTodos, storageKey, validateTodos, type Todo } from "../todos.ts";

const todo = { content: "do it", status: "pending", priority: "high" };

test("valid list passes and normalizes content", () => {
  const result = validateTodos({ todos: [{ ...todo, content: "  do it  ", extra: 1 }] }, 50);
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.todos, [{ content: "do it", status: "pending", priority: "high" }]);
});

test("empty list is allowed (clears the list)", () => {
  const result = validateTodos({ todos: [] }, 50);
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.todos, []);
});

test("non-object input and non-array todos fail", () => {
  assert.equal(validateTodos("nope", 50).ok, false);
  assert.equal(validateTodos({ todos: "nope" }, 50).ok, false);
});

test("all errors are reported at once", () => {
  const result = validateTodos(
    {
      todos: [
        { content: "", status: "done", priority: "urgent" },
        "not an object",
      ],
    },
    50,
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.errors.some((e) => e.includes("todos[0].content")));
    assert.ok(result.errors.some((e) => e.includes("todos[0].status")));
    assert.ok(result.errors.some((e) => e.includes("todos[0].priority")));
    assert.ok(result.errors.some((e) => e.includes("todos[1]")));
  }
});

test("maxTodos is enforced", () => {
  const many = { todos: Array.from({ length: 3 }, () => ({ ...todo })) };
  assert.equal(validateTodos(many, 2).ok, false);
  assert.equal(validateTodos(many, 3).ok, true);
});

test("saveTodos stores the list under the session key", async () => {
  const store = new Map<string, unknown>();
  const storage = {
    get: async (key: string) => store.get(key),
    set: async (key: string, value: unknown) => void store.set(key, value),
  };
  const todos: Todo[] = [{ content: "do it", status: "in_progress", priority: "medium" }];
  await saveTodos(storage, "ses_123", todos);
  assert.equal(storageKey("ses_123"), "todo/ses_123");
  assert.deepEqual(store.get("todo/ses_123"), todos);
});

test("formatTodos echoes the todowrite output shape", () => {
  const todos: Todo[] = [{ content: "do it", status: "in_progress", priority: "high" }];
  assert.equal(formatTodos(todos), JSON.stringify({ todos }));
  assert.equal(formatTodos([]), '{"todos":[]}');
});

test("loadTodos reads a missing entry as an empty list", async () => {
  const storage = { get: async () => undefined, set: async () => {} };
  assert.deepEqual(await loadTodos(storage, "ses_123"), { ok: true, todos: [] });
});

test("loadTodos reads back a saved list", async () => {
  const store = new Map<string, unknown>();
  const storage = {
    get: async (key: string) => store.get(key),
    set: async (key: string, value: unknown) => void store.set(key, value),
  };
  const todos: Todo[] = [{ content: "do it", status: "in_progress", priority: "medium" }];
  await saveTodos(storage, "ses_123", todos);
  assert.deepEqual(await loadTodos(storage, "ses_123"), { ok: true, todos });
});

test("normalizeTodos trims content and drops extra fields", () => {
  const result = normalizeTodos([{ content: "  do it  ", status: "pending", priority: "high", extra: 1 }]);
  assert.deepEqual(result, { ok: true, todos: [{ content: "do it", status: "pending", priority: "high" }] });
});

test("normalizeTodos reports all errors at once", () => {
  const result = normalizeTodos([{ content: "", status: "done", priority: "urgent" }, "nope"]);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.errors.some((e) => e.includes("todos[0].content")));
    assert.ok(result.errors.some((e) => e.includes("todos[0].status")));
    assert.ok(result.errors.some((e) => e.includes("todos[0].priority")));
    assert.ok(result.errors.some((e) => e.includes("todos[1]")));
  }
});

test("normalizeTodos rejects non-array stored values", () => {
  assert.equal(normalizeTodos({ broken: true }).ok, false);
});
