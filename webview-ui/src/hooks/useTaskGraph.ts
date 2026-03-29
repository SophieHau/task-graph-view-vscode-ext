import { useState, useEffect, useCallback, useMemo } from "react";
import type { Task, TaskGraph } from "../../../src/types";

export type { Task, TaskGraph };

// Shared layout metrics — imported by App.tsx to keep rendering in sync
export const NODE_W = 160;
export const NODE_H = 72;
export const GAP_X = 60;
export const GAP_Y = 50;

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
  // filename only comes from initial data — no setter needed
  const filename = window.__INITIAL_DATA__?.filename ?? "tasks.json";
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

  // Memoised: only recomputes when task list changes, not on every node click
  const layout = useMemo(() => computeLayout(graph.tasks), [graph.tasks]);

  return { graph, filename, selected, selectTask, layout };
}

export interface LayoutNode {
  task: Task;
  x: number;
  y: number;
  col: number;
  row: number;
}

/**
 * Assigns pixel coordinates to each task via topological level assignment.
 * Tasks with no dependencies are at level 0; each task sits one level beyond
 * its deepest dependency. Cycles are rejected by the parser so no guard is needed.
 */
function computeLayout(tasks: Task[]): Map<string, LayoutNode> {
  const map = new Map<string, Task>(tasks.map((t) => [t.id, t]));
  const levels = new Map<string, number>();

  function getLevel(id: string): number {
    if (levels.has(id)) return levels.get(id)!;
    const task = map.get(id);
    if (!task?.dependsOn?.length) {
      levels.set(id, 0);
      return 0;
    }
    const level = Math.max(...task.dependsOn.map(getLevel)) + 1;
    levels.set(id, level);
    return level;
  }

  tasks.forEach((t) => getLevel(t.id));

  // Group tasks by level column
  const byLevel = new Map<number, string[]>();
  for (const [id, level] of levels) {
    if (!byLevel.has(level)) byLevel.set(level, []);
    byLevel.get(level)!.push(id);
  }

  const result = new Map<string, LayoutNode>();
  for (const [level, ids] of byLevel) {
    ids.forEach((id, i) => {
      result.set(id, {
        task: map.get(id)!,
        col: level,
        row: i,
        x: level * (NODE_W + GAP_X),
        y: i * (NODE_H + GAP_Y),
      });
    });
  }

  return result;
}