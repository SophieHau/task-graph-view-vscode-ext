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
  meta?: {
    name?: string;
    version?: string;
  };
}

export type ParseResult =
  | { success: true; data: TaskGraph }
  | { success: false; error: string };

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

function isStatus(v: unknown): v is Task["status"] {
  return ["pending", "running", "done", "failed"].includes(v as string);
}

function isPriority(v: unknown): v is Task["priority"] {
  return ["low", "medium", "high", "critical"].includes(v as string);
}
