import type { Task, TaskGraph } from "./types";
export type { Task, TaskGraph };

/**
 * Discriminated union returned by {@link parseTasksFile}.
 * On success, `data` contains the validated graph.
 * On failure, `error` contains a human-readable message.
 */
export type ParseResult =
  | { success: true; data: TaskGraph }
  | { success: false; error: string };

/**
 * Parses and validates the raw content of a `tasks.json` file.
 *
 * Validation rules:
 * - Root must be a JSON object with a `tasks` array.
 * - Each task must be an object with a unique, non-empty string `id`.
 * - All `dependsOn` references must point to a declared task `id`.
 *
 * Invalid or missing optional fields (`label`, `status`, `priority`,
 * `description`) are silently normalised to their defaults rather than
 * rejected, so the graph always renders something useful.
 *
 * @param raw - Raw UTF-8 string content of the file.
 * @returns A {@link ParseResult} indicating success or failure.
 */
export function parseTasksFile(raw: string): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    return { success: false, error: `JSON parse error: ${(e as Error).message}` };
  }

  if (typeof json !== "object" || json === null || !("tasks" in json)) {
    return { success: false, error: 'Root object must have a "tasks" array.' };
  }

  const obj = json as Record<string, unknown>;
  if (!Array.isArray(obj.tasks)) {
    return { success: false, error: '"tasks" must be an array.' };
  }

  const tasks: Task[] = [];
  const ids = new Set<string>();

  for (const [i, t] of (obj.tasks as unknown[]).entries()) {
    if (typeof t !== "object" || t === null) {
      return { success: false, error: `Task at index ${i} is not an object.` };
    }
    const task = t as Record<string, unknown>;
    if (typeof task.id !== "string" || !task.id) {
      return { success: false, error: `Task at index ${i} is missing a string "id".` };
    }
    if (ids.has(task.id)) {
      return { success: false, error: `Duplicate task id: "${task.id}".` };
    }
    ids.add(task.id);
    tasks.push({
      id: task.id,
      label: typeof task.label === "string" ? task.label : task.id,
      description: typeof task.description === "string" ? task.description : undefined,
      dependsOn: Array.isArray(task.dependsOn)
        ? (task.dependsOn as unknown[]).filter((d): d is string => typeof d === "string")
        : [],
      status: isStatus(task.status) ? task.status : "pending",
      priority: isPriority(task.priority) ? task.priority : "medium",
    });
  }

  // Validate dependency references
  for (const task of tasks) {
    /* istanbul ignore next */
    for (const dep of task.dependsOn ?? []) {
      if (!ids.has(dep)) {
        return { success: false, error: `Task "${task.id}" depends on unknown id "${dep}".` };
      }
    }
  }

  return {
    success: true,
    data: {
      tasks,
      meta: typeof obj.meta === "object" && obj.meta !== null ? (obj.meta as TaskGraph["meta"]) : {},
    },
  };
}

/** Returns `true` if `v` is a valid {@link Task} status string. */
function isStatus(v: unknown): v is Task["status"] {
  return ["pending", "running", "done", "failed"].includes(v as string);
}

/** Returns `true` if `v` is a valid {@link Task} priority string. */
function isPriority(v: unknown): v is Task["priority"] {
  return ["low", "medium", "high", "critical"].includes(v as string);
}
