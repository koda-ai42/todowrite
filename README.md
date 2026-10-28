# todowrite

Restores the V1-style **todo tools** for **OpenCode V2**, which has no built-in todo
tool. Registers two native tools:

- **`todowrite`** — the model passes the complete todo list on every call; the
  plugin validates it, stores it per session via `ctx.storage` (key
  `todo/<sessionID>`), and echoes it back as JSON. Each item has `content`
  (string), `status` (`pending` | `in_progress` | `completed`), and `priority`
  (`high` | `medium` | `low`).
- **`todoread`** — takes no arguments and returns the session's stored list as
  JSON, so the model can recover it after context compaction. Disable with
  `readEnabled: false`.

Both tools read and write the same plugin-scoped storage directly; no RPC or
cross-plugin contracts are involved.

## Install

The plugin needs **no `npm install` at the install target**: it uses only Node
built-ins and imports `@opencode/plugin` type-only (the host injects the real
modules). A `node_modules/` directory is a gitignored dev-only artifact (tests
and typecheck) and is never needed at runtime.

Recommended — install from GitHub:

```sh
opencode plugin add github:koda-ai42/todowrite
```

Or add it to `opencode.jsonc`:

```jsonc
{
  "plugins": ["github:koda-ai42/todowrite"]
}
```

For config overrides, use the object form:

```jsonc
{
  "plugins": [
    {
      "package": "github:koda-ai42/todowrite",
      "options": { "maxTodos": 20, "readEnabled": true }
    }
  ]
}
```

Or clone the repo and point OpenCode at a local path — a symlink into
`~/.config/opencode/plugins/` gives live-edit development:

```sh
git clone https://github.com/koda-ai42/todowrite ~/src/todowrite
mkdir -p ~/.config/opencode/plugins
ln -s ~/src/todowrite ~/.config/opencode/plugins/todowrite
```

## Configuration

`todowrite.json` (next to `index.ts`, resolved relative to the plugin module)
is declarative only. Invalid config disables the plugin with a clear error
instead of partially applying.

| Field            | Meaning                                                        |
| ---------------- | -------------------------------------------------------------- |
| `writeToolName`  | Write tool name registered with the model                       |
| `description`    | Write tool description shown to the model                       |
| `maxTodos`       | Maximum items accepted in one list (1–200)                      |
| `codemode`       | `false` (default): native tools; `true`: Code Mode only (`tools.<name>`) |
| `readToolName`   | Read tool name (default `todoread`)                             |
| `readDescription`| Read tool description (sensible default provided)               |
| `readEnabled`    | `true` (default): also register the read tool                   |
| `systemGuidance` | `true` (default): append a system line telling the model to plan with the write tool before executing and to update the list at meaningful checkpoints |

The shipped `todowrite.json` sets `readEnabled: false`; flip it to `true` (or
set it via `options`) for long sessions where compaction could hide the list.

Tool names are validated fail-closed: they must differ from each other (when
the read tool is enabled) and must not collide with built-in tool names
(`execute`, `read`, `write`, `edit`, `patch`, `glob`, `grep`, `shell`,
`question`, `skill`, `subagent`, `webfetch`, `websearch`), since a plugin tool
with the same effective name would silently override the built-in one.

Options passed via a plugin config entry's `options` object take highest
precedence.

## Development

Requires **Node 22+** (the `node --test` glob needs it).

```sh
# at the repo root
npm install
npm run typecheck
npm test
```

Verify loading via `~/.local/share/opencode/log/opencode.log` (look for
`[todowrite]` lines and plugin reconciliation without errors).

## License

MIT — see [LICENSE](LICENSE).
