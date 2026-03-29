// Minimal vscode mock for unit tests
export const window = {
  showErrorMessage: jest.fn(),
  showInformationMessage: jest.fn(),
  showQuickPick: jest.fn(),
};
export const commands = { registerCommand: jest.fn() };
export const workspace = { findFiles: jest.fn(), asRelativePath: jest.fn() };
export const Uri = { joinPath: jest.fn(), fsPath: "" };
export const ViewColumn = { One: 1 };
