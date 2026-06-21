import * as path from "path";
import * as vscode from "vscode";
import { findMarkdownFilesRecursive, readTextFile } from "./fileScanner";
import {
  extractHeadings,
  formatHeadingLabel,
  ManuscriptHeading,
} from "./headingParser";
import {
  filterManuscriptPaths,
  resolveDraftFolderPath,
  WorkFolderConfig,
} from "./workFolder";

export interface NavigationTarget {
  label: string;
  description?: string;
  detail?: string;
  filePath: string;
  line: number;
}

export function buildDraftNavigationTargets(
  draftFolderPath: string,
  filePaths: string[],
  fileContents: Map<string, string>,
  config: WorkFolderConfig
): NavigationTarget[] {
  const filtered = filterManuscriptPaths(
    draftFolderPath,
    filePaths,
    config.manuscriptExcludeGlobs
  );

  filtered.sort((a, b) =>
    path.basename(a).localeCompare(path.basename(b), "ja", { numeric: true })
  );

  const targets: NavigationTarget[] = [];

  for (const filePath of filtered) {
    const content = fileContents.get(filePath);
    if (content === undefined) {
      continue;
    }

    const relativePath = path.relative(draftFolderPath, filePath);
    const fileName = path.basename(filePath);
    const headings = extractHeadings(content);

    if (headings.length === 0) {
      targets.push({
        label: fileName,
        description: relativePath,
        filePath,
        line: 0,
      });
      continue;
    }

    for (const heading of headings) {
      targets.push({
        label: formatHeadingLabel(heading, fileName),
        description: relativePath,
        detail: heading.level === 1 ? "章" : "節",
        filePath,
        line: heading.line,
      });
    }
  }

  return targets;
}

export async function jumpToTarget(
  target: NavigationTarget
): Promise<void> {
  const doc = await vscode.workspace.openTextDocument(
    vscode.Uri.file(target.filePath)
  );
  const editor = await vscode.window.showTextDocument(doc);

  const position = new vscode.Position(target.line, 0);
  editor.selection = new vscode.Selection(position, position);
  editor.revealRange(
    new vscode.Range(position, position),
    vscode.TextEditorRevealType.InCenter
  );
}

export async function showJumpPicker(
  draftFolderPath: string,
  activeEditor: vscode.TextEditor | undefined,
  config: WorkFolderConfig
): Promise<void> {
  const filePaths = findMarkdownFilesRecursive(draftFolderPath);
  const fileContents = new Map<string, string>();

  for (const fsPath of filePaths) {
    if (activeEditor && activeEditor.document.uri.fsPath === fsPath) {
      fileContents.set(fsPath, activeEditor.document.getText());
    } else {
      fileContents.set(fsPath, readTextFile(fsPath));
    }
  }

  const activePath = activeEditor?.document.uri.fsPath;
  if (
    activePath &&
    activePath.startsWith(draftFolderPath) &&
    !fileContents.has(activePath)
  ) {
    filePaths.push(activePath);
    fileContents.set(activePath, activeEditor!.document.getText());
  }

  const targets = buildDraftNavigationTargets(
    draftFolderPath,
    filePaths,
    fileContents,
    config
  );

  if (targets.length === 0) {
    vscode.window.showInformationMessage("ジャンプ先が見つかりません。");
    return;
  }

  const picked = await vscode.window.showQuickPick(targets, {
    placeHolder: "章・節・ファイルへジャンプ",
    matchOnDescription: true,
    matchOnDetail: true,
  });

  if (picked) {
    await jumpToTarget(picked);
  }
}

export async function jumpWithinCurrentFile(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  const headings = extractHeadings(editor.document.getText());
  if (headings.length === 0) {
    vscode.window.showInformationMessage("このファイルに見出しがありません。");
    return;
  }

  const fileName = path.basename(editor.document.fileName);
  const items = headings.map((heading) => ({
    label: formatHeadingLabel(heading),
    description: fileName,
    detail: heading.level === 1 ? "章" : "節",
    filePath: editor.document.uri.fsPath,
    line: heading.line,
  }));

  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: "章・節へジャンプ（このファイル内）",
  });

  if (picked) {
    await jumpToTarget(picked);
  }
}

export function registerNavigationCommands(
  context: vscode.ExtensionContext,
  getConfig: () => WorkFolderConfig
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("japaneseFiction.jumpToSection", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }

      const config = getConfig();
      const filePath = editor.document.uri.fsPath;
      const draftFolderPath = resolveDraftFolderPath(
        filePath,
        config.draftFolderNames,
        config.settingsFolderName
      );

      if (!draftFolderPath) {
        vscode.window.showInformationMessage(
          "稿フォルダ内の Markdown ファイルを開いてください。"
        );
        return;
      }

      await showJumpPicker(draftFolderPath, editor, config);
    }),
    vscode.commands.registerCommand(
      "japaneseFiction.jumpWithinFile",
      () => jumpWithinCurrentFile()
    )
  );
}
