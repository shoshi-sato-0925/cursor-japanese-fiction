import * as vscode from "vscode";
import { isCountableManuscriptFile, WorkFolderConfig } from "./workFolder";

export function isNovelMarkdownDocument(doc: vscode.TextDocument): boolean {
  if (doc.languageId === "markdown" || doc.languageId === "plaintext") {
    return doc.fileName.endsWith(".md");
  }
  return doc.languageId === "markdown";
}

export function isNovelManuscriptPath(
  filePath: string,
  config: WorkFolderConfig
): boolean {
  return isCountableManuscriptFile(filePath, config);
}

export function getActiveNovelEditor(
  config: WorkFolderConfig
): vscode.TextEditor | undefined {
  const editor = vscode.window.activeTextEditor;
  if (!editor || !isNovelMarkdownDocument(editor.document)) {
    return undefined;
  }

  if (!isNovelManuscriptPath(editor.document.uri.fsPath, config)) {
    return undefined;
  }

  return editor;
}

export async function updateNovelContext(
  config: WorkFolderConfig
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  const active =
    !!editor &&
    isNovelMarkdownDocument(editor.document) &&
    isNovelManuscriptPath(editor.document.uri.fsPath, config);

  await vscode.commands.executeCommand(
    "setContext",
    "japaneseFiction.isNovelManuscript",
    active
  );
}
