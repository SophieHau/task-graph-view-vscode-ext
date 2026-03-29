import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { TaskGraphPanel } from "./TaskGraphPanel";
import { parseTasksFile } from "./taskParser";

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    "taskGraphView.show",
    async (uri?: vscode.Uri) => {
      // Resolve the tasks.json path: from context menu URI or workspace search
      let filePath: string | undefined;

      if (uri) {
        filePath = uri.fsPath;
      } else {
        const files = await vscode.workspace.findFiles("**/tasks.json", "**/node_modules/**", 5);
        if (files.length === 0) {
          vscode.window.showErrorMessage("No tasks.json found in workspace.");
          return;
        }
        if (files.length === 1) {
          filePath = files[0].fsPath;
        } else {
          const picked = await vscode.window.showQuickPick(
            files.map((f) => ({ label: vscode.workspace.asRelativePath(f), uri: f })),
            { placeHolder: "Select a tasks.json file" }
          );
          if (!picked) return;
          filePath = picked.uri.fsPath;
        }
      }

      if (!fs.existsSync(filePath)) {
        vscode.window.showErrorMessage(`File not found: ${filePath}`);
        return;
      }

      const raw = fs.readFileSync(filePath, "utf-8");
      const result = parseTasksFile(raw);

      if (!result.success) {
        vscode.window.showErrorMessage(`Invalid tasks.json: ${result.error}`);
        return;
      }

      TaskGraphPanel.createOrShow(context.extensionUri, result.data!, path.basename(filePath));

      // Watch file for live reload
      const watcher = fs.watch(filePath, () => {
        try {
          const updated = fs.readFileSync(filePath!, "utf-8");
          const res = parseTasksFile(updated);
          if (res.success) {
            TaskGraphPanel.update(res.data!);
          }
        } catch {
          // ignore transient read errors during save
        }
      });

      context.subscriptions.push({ dispose: () => watcher.close() });
    }
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {}
