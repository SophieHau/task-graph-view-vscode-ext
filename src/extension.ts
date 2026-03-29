/**
 * Extension entry point for the Task Graph View VS Code / Theia extension.
 *
 * Responsibilities:
 * - Register the `taskGraphView.show` command.
 * - Resolve the target `tasks.json` file (from context menu URI or workspace search).
 * - Parse and validate the file via {@link parseTasksFile}.
 * - Open (or reveal) the {@link TaskGraphPanel} webview.
 * - Set up a file-system watcher for live reload on save.
 */
import * as vscode from "vscode";
import { TaskGraphPanel } from "./TaskGraphPanel";
import { parseTasksFile } from "./taskParser";

/**
 * Called by VS Code / Theia when the extension is activated.
 * Registers the `taskGraphView.show` command and adds it to `context.subscriptions`
 * so it is cleaned up automatically on deactivation.
 *
 * @param context - The extension context provided by the host.
 */
export function activate(context: vscode.ExtensionContext) {
  // Tracks the active file watcher so we can replace it when the user opens
  // a different tasks.json without leaking the previous watcher.
  let fileWatcher: vscode.Disposable | undefined;

  const disposable = vscode.commands.registerCommand(
    "taskGraphView.show",
    async (uri?: vscode.Uri) => {
      // Resolve the tasks.json URI: from context menu or workspace search
      let fileUri: vscode.Uri | undefined;

      if (uri) {
        fileUri = uri;
      } else {
        const files = await vscode.workspace.findFiles("**/tasks.json", "**/node_modules/**", 5);
        if (files.length === 0) {
          vscode.window.showErrorMessage("No tasks.json found in workspace.");
          return;
        }
        if (files.length === 1) {
          fileUri = files[0];
        } else {
          // Multiple matches — let the user pick
          const picked = await vscode.window.showQuickPick(
            files.map((f) => ({ label: vscode.workspace.asRelativePath(f), uri: f })),
            { placeHolder: "Select a tasks.json file" }
          );
          if (!picked) return;
          fileUri = picked.uri;
        }
      }

      // Read asynchronously via the VS Code filesystem API so this works
      // in remote environments (SSH, WSL, Dev Containers, Codespaces)
      let raw: string;
      try {
        raw = new TextDecoder().decode(await vscode.workspace.fs.readFile(fileUri));
      } catch {
        vscode.window.showErrorMessage(`File not found: ${fileUri.fsPath}`);
        return;
      }

      const result = parseTasksFile(raw);
      if (!result.success) {
        vscode.window.showErrorMessage(`Invalid tasks.json: ${result.error}`);
        return;
      }

      const filename = fileUri.path.split("/").pop() ?? "tasks.json";
      TaskGraphPanel.createOrShow(context.extensionUri, result.data, filename);

      // Replace the previous watcher before creating a new one so that opening
      // a second tasks.json doesn't leave a dangling watcher on the first file.
      fileWatcher?.dispose();
      const watcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(
          vscode.Uri.file(fileUri.fsPath.replace(/[^/\\]+$/, "")),
          filename
        )
      );
      watcher.onDidChange(async () => {
        try {
          const updated = new TextDecoder().decode(
            await vscode.workspace.fs.readFile(fileUri!)
          );
          const res = parseTasksFile(updated);
          if (res.success) TaskGraphPanel.update(res.data);
        } catch { /* ignore transient read errors during save */ }
      });
      fileWatcher = watcher;
      context.subscriptions.push(watcher);
    }
  );

  context.subscriptions.push(disposable);
}

/**
 * Called by VS Code / Theia when the extension is deactivated.
 * All disposables registered in `context.subscriptions` are cleaned up automatically;
 * no additional teardown is required here.
 */
export function deactivate() {}