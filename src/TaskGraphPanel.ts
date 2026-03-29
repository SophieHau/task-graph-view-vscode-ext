/**
 * Manages the Task Graph webview panel.
 *
 * At most one panel exists at a time (tracked via {@link TaskGraphPanel.currentPanel}).
 * Calling {@link TaskGraphPanel.createOrShow} either creates a new panel or reveals
 * the existing one and pushes fresh data to it.
 *
 * Communication with the React webview uses VS Code's `postMessage` API:
 * - **Extension → Webview**: `{ type: "update", data: TaskGraph }` on file save.
 * - **Webview → Extension**: `{ command: "focusTask", taskId: string }` on node click.
 */
import * as vscode from "vscode";
import { randomBytes } from "crypto";
import type { TaskGraph } from "./types";

/**
 * Singleton wrapper around a {@link vscode.WebviewPanel} that renders
 * the task dependency graph.
 */
export class TaskGraphPanel {
  /** The currently active panel instance, or `undefined` if none is open. */
  public static currentPanel: TaskGraphPanel | undefined;

  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  /**
   * Private constructor — use {@link TaskGraphPanel.createOrShow} instead.
   *
   * @param panel - The underlying VS Code webview panel.
   * @param extensionUri - URI of the extension's install directory (used to resolve assets).
   * @param data - Initial task graph data to render.
   * @param filename - Base filename shown in the panel title.
   */
  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    data: TaskGraph,
    filename: string
  ) {
    this._panel = panel;
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.html = this._getHtmlForWebview(extensionUri, data, filename);

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      (message: { command: string; taskId?: string }) => {
        if (message.command === "focusTask" && message.taskId) {
          vscode.window.showInformationMessage(`Task: ${message.taskId}`);
        }
      },
      null,
      this._disposables
    );
  }

  /**
   * Opens the graph panel, or reveals and refreshes it if already open.
   *
   * If a panel already exists, the new `data` is pushed via `postMessage` so
   * the webview re-renders without a full reload. The panel title is also updated
   * to reflect the new filename.
   *
   * @param extensionUri - URI of the extension's install directory.
   * @param data - Task graph to display.
   * @param filename - Base filename shown in the panel title.
   */
  public static createOrShow(
    extensionUri: vscode.Uri,
    data: TaskGraph,
    filename: string
  ) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (TaskGraphPanel.currentPanel) {
      TaskGraphPanel.currentPanel._panel.title = `Task Graph — ${filename}`;
      TaskGraphPanel.currentPanel._panel.reveal(column);
      TaskGraphPanel.currentPanel._panel.webview.postMessage({ type: "update", data });
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "taskGraphView",
      `Task Graph — ${filename}`,
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, "dist", "webview")],
      }
    );

    TaskGraphPanel.currentPanel = new TaskGraphPanel(panel, extensionUri, data, filename);
  }

  /**
   * Pushes updated task graph data to the open panel.
   * No-op if no panel is currently open.
   *
   * @param data - Updated task graph data.
   */
  public static update(data: TaskGraph) {
    TaskGraphPanel.currentPanel?._panel.webview.postMessage({ type: "update", data });
  }

  /**
   * Generates the full HTML document served inside the webview.
   *
   * A Content Security Policy restricts script and style execution to
   * nonce-tagged elements only, preventing XSS from injected content.
   * Inline data is JSON-escaped to prevent `</script>` injection.
   *
   * @param extensionUri - URI of the extension's install directory.
   * @param data - Initial task graph serialised into `window.__INITIAL_DATA__`.
   * @param filename - Filename passed through to the React app.
   * @returns HTML string for the webview.
   */
  private _getHtmlForWebview(
    extensionUri: vscode.Uri,
    data: TaskGraph,
    filename: string
  ): string {
    const webview = this._panel.webview;
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, "dist", "webview", "index.js")
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, "dist", "webview", "index.css")
    );
    const nonce = getNonce();

    // Escape </script> sequences to prevent breaking out of the script block
    const safeJson = JSON.stringify({ data, filename })
      .replace(/</g, "\\u003c")
      .replace(/>/g, "\\u003e")
      .replace(/&/g, "\\u0026");

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none';
             style-src ${webview.cspSource};
             script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="${styleUri}" />
  <title>Task Graph</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}">
    window.__INITIAL_DATA__ = ${safeJson};
    window.__VSCODE_API__ = acquireVsCodeApi();
  </script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  /**
   * Disposes the panel and all associated resources.
   * Clears {@link TaskGraphPanel.currentPanel} so a new panel can be created.
   */
  public dispose() {
    TaskGraphPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      this._disposables.pop()?.dispose();
    }
  }
}

/**
 * Generates a cryptographically secure 32-character hex nonce
 * for use in the webview Content Security Policy.
 *
 * @returns A 32-character hex nonce string.
 */
function getNonce(): string {
  return randomBytes(16).toString("hex");
}