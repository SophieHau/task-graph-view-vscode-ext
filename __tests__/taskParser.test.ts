import { parseTasksFile } from "../src/taskParser";

describe("parseTasksFile", () => {
  it("parses a valid tasks.json", () => {
    const input = JSON.stringify({
      meta: { name: "My Pipeline" },
      tasks: [
        { id: "build", label: "Build", status: "done", priority: "high" },
        { id: "test", label: "Test", dependsOn: ["build"] },
        { id: "deploy", label: "Deploy", dependsOn: ["test"] },
      ],
    });
    const result = parseTasksFile(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tasks).toHaveLength(3);
      expect(result.data.tasks[1].dependsOn).toEqual(["build"]);
    }
  });

  it("fails on invalid JSON", () => {
    const result = parseTasksFile("{not json}");
    expect(result.success).toBe(false);
  });

  it("fails on missing tasks array", () => {
    const result = parseTasksFile(JSON.stringify({ items: [] }));
    expect(result.success).toBe(false);
  });

  it("fails on duplicate ids", () => {
    const result = parseTasksFile(
      JSON.stringify({ tasks: [{ id: "a" }, { id: "a" }] })
    );
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/duplicate/i);
  });

  it("fails on unknown dependency reference", () => {
    const result = parseTasksFile(
      JSON.stringify({ tasks: [{ id: "a", dependsOn: ["ghost"] }] })
    );
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/unknown id/i);
  });

  it("defaults status to pending and priority to medium", () => {
    const result = parseTasksFile(JSON.stringify({ tasks: [{ id: "x" }] }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tasks[0].status).toBe("pending");
      expect(result.data.tasks[0].priority).toBe("medium");
    }
  });
});
