# task-graph-view

A VS Code / Eclipse Theia extension that renders an interactive dependency graph from a `tasks.json` file, live-reloading on every save.

![CI](https://github.com/YOUR_USERNAME/task-graph-view/actions/workflows/ci.yml/badge.svg)

## Features

- **Dependency graph** — visualizes task relationships as a directed acyclic graph, laid out by topological level
- **Status & priority indicators** — color-coded status bar (pending / running / done / failed) and priority dot per node
- **Live reload** — file watcher triggers a graph update every time you save `tasks.json`, without reopening the panel
- **Detail panel** — click any node to inspect its description, status, priority, and dependencies; click a dep to jump to it
- **Context menu** — right-click any `tasks.json` in the Explorer to open the graph directly

## Usage

1. Create a `tasks.json` file in your workspace (see [examples/tasks.json](examples/tasks.json))
2. Open the Command Palette (`Ctrl+Shift+P`) and run **Task Graph View: Show Graph**
3. Or right-click a `tasks.json` file in the Explorer → **Task Graph View: Show Graph**

## `tasks.json` schema

```json
{
  "meta": { "name": "My Pipeline" },
  "tasks": [
    {
      "id": "build",
      "label": "Build",
      "description": "Compile sources.",
      "status": "done",
      "priority": "high"
    },
    {
      "id": "test",
      "label": "Run Tests",
      "dependsOn": ["build"],
      "status": "pending",
      "priority": "high"
    }
  ]
}
```

| Field | Type | Required | Values |
|---|---|---|---|
| `id` | string | ✅ | unique identifier |
| `label` | string | | display name (defaults to id) |
| `description` | string | | free text |
| `dependsOn` | string[] | | list of task ids |
| `status` | string | | `pending` · `running` · `done` · `failed` |
| `priority` | string | | `low` · `medium` · `high` · `critical` |

## Architecture

```
task-graph-view/
├── src/                    # Extension host (Node.js / TypeScript)
│   ├── extension.ts        # Activation, command registration, file watcher
│   ├── TaskGraphPanel.ts   # Webview panel lifecycle
│   └── taskParser.ts       # tasks.json validation & parsing
├── webview-ui/             # Webview frontend (React / TypeScript / Vite)
│   └── src/
│       ├── components/App.tsx   # SVG graph renderer + detail panel
│       └── hooks/useTaskGraph.ts # State, VS Code message bridge, layout engine
├── __tests__/
│   └── taskParser.test.ts  # Unit tests (Jest)
├── examples/
│   └── tasks.json          # Demo pipeline
└── .github/workflows/ci.yml
```

The extension host and the Webview communicate via VS Code's `postMessage` API:
- Extension → Webview: `{ type: "update", data: TaskGraph }` on file save
- Webview → Extension: `{ command: "focusTask", taskId: string }` on node click

## Development

```bash
# Install dependencies
npm install
cd webview-ui && npm install && cd ..

# Watch mode (two terminals)
npm run watch:ext
npm run watch:ui

# Tests
npm test

# Press F5 in VS Code to launch the Extension Development Host
```

## Compatibility

Designed to work as both a **VS Code extension** and an **Eclipse Theia extension** — the extension manifest and API surface intentionally stay within the common subset supported by both platforms.

## License

MIT
