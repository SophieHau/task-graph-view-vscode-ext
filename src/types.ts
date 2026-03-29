/**
 * Shared domain types used by both the extension host and the webview.
 *
 * This file must remain free of any Node.js, VS Code, or browser imports
 * so it can be safely bundled by both esbuild (extension) and Vite (webview).
 */

/** A single task node in the dependency graph. */
export interface Task {
  /** Unique identifier. */
  id: string;
  /** Human-readable display name. Defaults to `id` if omitted. */
  label: string;
  /** Optional free-text description. */
  description?: string;
  /** IDs of tasks this one depends on. */
  dependsOn?: string[];
  /** Current execution state. */
  status?: "pending" | "running" | "done" | "failed";
  /** Importance level for visual prioritization. */
  priority?: "low" | "medium" | "high" | "critical";
}

/** Root structure of a `tasks.json` file. */
export interface TaskGraph {
  tasks: Task[];
  meta?: {
    name?: string;
    version?: string;
  };
}
