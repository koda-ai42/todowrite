import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig, validateConfig } from "../config.ts";

const valid = {
  schemaVersion: 1,
  writeToolName: "todowrite",
  description: "Track session tasks",
  maxTodos: 50,
};

test("valid config passes", () => {
  const { config, errors } = validateConfig(valid);
  assert.deepEqual(errors, []);
  assert.equal(config?.writeToolName, "todowrite");
  assert.equal(config?.maxTodos, 50);
  assert.equal(config?.codemode, false);
});

test("legacy toolName field no longer validates (fail closed)", () => {
  const { writeToolName, ...legacy } = { ...valid, toolName: "todowrite" };
  void writeToolName;
  const { config, errors } = validateConfig(legacy);
  assert.equal(config, undefined);
  assert.ok(errors.some((e) => e.startsWith("writeToolName:")));
});

test("codemode defaults to false and accepts booleans", () => {
  assert.equal(validateConfig(valid).config?.codemode, false);
  assert.equal(validateConfig({ ...valid, codemode: true }).config?.codemode, true);
  assert.ok(validateConfig({ ...valid, codemode: "yes" }).errors.some((e) => e.startsWith("codemode:")));
});

test("read tool fields default and validate", () => {
  const defaults = validateConfig(valid).config;
  assert.equal(defaults?.readToolName, "todoread");
  assert.equal(defaults?.readEnabled, true);
  assert.ok(defaults?.readDescription.length);

  assert.equal(validateConfig({ ...valid, readEnabled: false }).config?.readEnabled, false);
  assert.equal(validateConfig({ ...valid, readToolName: "todo_read" }).config?.readToolName, "todo_read");
  const bad = validateConfig({ ...valid, readToolName: "bad name", readEnabled: "yes", readDescription: " " });
  assert.ok(bad.errors.some((e) => e.startsWith("readToolName:")));
  assert.ok(bad.errors.some((e) => e.startsWith("readEnabled:")));
  assert.ok(bad.errors.some((e) => e.startsWith("readDescription:")));
});

test("systemGuidance defaults to true and accepts booleans", () => {
  assert.equal(validateConfig(valid).config?.systemGuidance, true);
  assert.equal(validateConfig({ ...valid, systemGuidance: false }).config?.systemGuidance, false);
  assert.ok(validateConfig({ ...valid, systemGuidance: "yes" }).errors.some((e) => e.startsWith("systemGuidance:")));
});

test("identical tool names are rejected unless the read tool is disabled", () => {
  const dup = validateConfig({ ...valid, readToolName: "todowrite" });
  assert.ok(dup.errors.some((e) => e.includes("must differ from writeToolName")));
  assert.equal(validateConfig({ ...valid, readToolName: "todowrite", readEnabled: false }).config?.readToolName, "todowrite");
});

test("built-in tool names are rejected for both tool name fields", () => {
  assert.ok(validateConfig({ ...valid, writeToolName: "read" }).errors.some((e) => e.includes("collides with a built-in tool")));
  assert.ok(validateConfig({ ...valid, writeToolName: "execute" }).errors.some((e) => e.includes("collides with a built-in tool")));
  assert.ok(validateConfig({ ...valid, readToolName: "shell" }).errors.some((e) => e.includes("collides with a built-in tool")));
});

test("invalid config fails closed with messages", () => {
  const { config, errors } = validateConfig({ schemaVersion: 2 });
  assert.equal(config, undefined);
  assert.ok(errors.length > 0);
});

test("bad writeToolName and maxTodos are rejected", () => {
  const { errors } = validateConfig({ ...valid, writeToolName: "bad name", maxTodos: 0 });
  assert.ok(errors.some((e) => e.startsWith("writeToolName:")));
  assert.ok(errors.some((e) => e.startsWith("maxTodos:")));
});

test("entry options override the file", async () => {
  const dir = await mkdtemp(join(tmpdir(), "todowrite-test-"));
  const file = join(dir, "cfg.json");
  await writeFile(file, JSON.stringify(valid));
  const result = await loadConfig(new URL(`file://${file}`), { maxTodos: 10 });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.config.maxTodos, 10);
});

test("missing file disables with a clear error", async () => {
  const result = await loadConfig(new URL("file:///nonexistent/todowrite.json"));
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.errors[0], /cannot read config/);
});
