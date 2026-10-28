import { test } from "node:test";
import assert from "node:assert/strict";
import { buildGuidance } from "../guidance.ts";

test("guidance names the write tool and demands up-front planning", () => {
  const text = buildGuidance("todowrite");
  assert.match(text, /`todowrite`/);
  assert.match(text, /BEFORE executing the first step/);
});

test("guidance uses checkpoint cadence and permits batching", () => {
  const text = buildGuidance("todowrite");
  assert.match(text, /at meaningful checkpoints/);
  assert.match(text, /batching minor updates is fine/);
  assert.doesNotMatch(text, /Never batch/);
});

test("guidance mentions the read tool only when provided", () => {
  assert.match(buildGuidance("todowrite", "todoread"), /`todoread`/);
  assert.doesNotMatch(buildGuidance("todowrite"), /todoread/);
});

test("guidance tracks custom tool names", () => {
  assert.match(buildGuidance("todo_write", "todo_read"), /`todo_write`/);
  assert.match(buildGuidance("todo_write", "todo_read"), /`todo_read`/);
});
