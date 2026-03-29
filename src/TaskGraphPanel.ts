import * as vscode from "vscode";
import { TaskGraph } from "./taskParser";

export class TaskGraphPanel {
  public static currentPanel: TaskGraphPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

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

  public static createOrShow(
    extensionUri: vscode.Uri,
    data: TaskGraph,
    filename: string
  ) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (TaskGraphPanel.currentPanel) {
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
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, "dist", "webview")],
      }
    );

    TaskGraphPanel.currentPanel = new TaskGraphPanel(panel, extensionUri, data, filename);
  }

  public static update(data: TaskGraph) {
    TaskGraphPanel.currentPanel?._panel.webview.postMessage({ type: "update", data });
  }

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

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none';
             style-src ${webview.cspSource} 'unsafe-inline';
             script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="${styleUri}" />
  <title>Task Graph</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}">
    window.__INITIAL_DATA__ = ${JSON.stringify({ data, filename })};
    window.__VSCODE_API__ = acquireVsCodeApi();
  </script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  public dispose() {
    TaskGraphPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      this._disposables.pop()?.dispose();
    }
  }
}

function getNonce(): string {
  let text = "";
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
