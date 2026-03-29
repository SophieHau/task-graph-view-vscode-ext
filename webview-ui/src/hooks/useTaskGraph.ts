import { useState, useEffect, useCallback } from "react";

export interface Task {
  id: string;
  label: string;
  description?: string;
  dependsOn?: string[];
  status?: "pending" | "running" | "done" | "failed";
  priority?: "low" | "medium" | "high" | "critical";
}

export interface TaskGraph {
  tasks: Task[];
  meta?: { name?: string; version?: string };
}

interface InitialData {
  data: TaskGraph;
  filename: string;
}

declare global {
  interface Window {
    __INITIAL_DATA__: InitialData;
    __VSCODE_API__: { postMessage: (msg: unknown) => void };
  }
}

export function useTaskGraph() {
  const [graph, setGraph] = useState<TaskGraph>(
    window.__INITIAL_DATA__?.data ?? { tasks: [] }
  );
  const [filename, setFilename] = useState<string>(
    window.__INITIAL_DATA__?.filename ?? "tasks.json"
  );
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const handler = (event: MessageEvent<{ type: string; data?: TaskGraph }>) => {
      if (event.data?.type === "update" && event.data.data) {
        setGraph(event.data.data);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const selectTask = useCallback((id: string | null) => {
    setSelected(id);
    if (id) {
      window.__VSCODE_API__?.postMessage({ command: "focusTask", taskId: id });
    }
  }, []);

  // Compute layout positions using a simple topological sort + level assignment
  const layout = computeLayout(graph.tasks);

  return { graph, filename, selected, selectTask, layout };
}

export interface LayoutNode {
  task: Task;
  x: number;
  y: number;
  col: number;
  row: number;
}

function computeLayout(tasks: Task[]): Map<string, LayoutNode> {
  const map = new Map<string, Task>(tasks.map((t) => [t.id, t]));
  const levels = new Map<string, number>();

  function getLevel(id: string, visited = new Set<string>()): number {
    if (levels.has(id)) return levels.get(id)!;
    if (visited.has(id)) return 0; // cycle guard
    visited.add(id);
    const task = map.get(id);
    if (!task || !task.dependsOn?.length) {
      levels.set(id, 0);
      return 0;
    }
    const maxDep = Math.max(...task.dependsOn.map((d) => getLevel(d, new Set(visited))));
    const level = maxDep + 1;
    levels.set(id, level);
    return level;
  }

  tasks.forEach((t) => getLevel(t.id));

  // Group by level
  const byLevel = new Map<number, string[]>();
  for (const [id, level] of levels) {
    if (!byLevel.has(level)) byLevel.set(level, []);
    byLevel.get(level)!.push(id);
  }

  const NODE_W = 160;
  const NODE_H = 72;
  const GAP_X = 60;
  const GAP_Y = 50;

  const result = new Map<string, LayoutNode>();

  for (const [level, ids] of byLevel) {
    ids.forEach((id, i) => {
      const task = map.get(id)!;
      result.set(id, {
        task,
        col: level,
        row: i,
        x: level * (NODE_W + GAP_X),
        y: i * (NODE_H + GAP_Y),
      });
    });
  }

  return result;
}
