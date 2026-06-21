import * as vscode from "vscode";
import {
  formatNumber,
  formatPages,
  WorkManuscriptStats,
} from "./manuscriptCounter";
import {
  analyzeDraftFolder,
  emptyDraftStats,
  resolveDraftFolderPath,
  resolveNovelTitle,
  WorkFolderConfig,
} from "./workFolder";
import { findMarkdownFilesRecursive, readTextFile } from "./fileScanner";
import {
  isNovelMarkdownDocument,
  updateNovelContext,
} from "./novelContext";
import { registerSymbolCommands } from "./symbolInsert";
import { registerNavigationCommands } from "./navigation";
import { registerOutlineView, ManuscriptOutlineProvider } from "./outlineProvider";

let statusBarItem: vscode.StatusBarItem;
let outputChannel: vscode.OutputChannel;
let outlineProvider: ManuscriptOutlineProvider | undefined;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;
let lastStats: WorkManuscriptStats | undefined;

export function activate(context: vscode.ExtensionContext): void {
  outputChannel = vscode.window.createOutputChannel("Japanese Fiction");
  context.subscriptions.push(outputChannel);

  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.command = "japaneseFiction.showManuscriptReport";
  context.subscriptions.push(statusBarItem);

  registerSymbolCommands(context);
  registerNavigationCommands(context, getConfig);
  outlineProvider = registerOutlineView(context, getConfig);

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "japaneseFiction.showManuscriptReport",
      () => showReport()
    ),
    vscode.commands.registerCommand("japaneseFiction.refreshCount", () =>
      refreshStats()
    ),
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (isActiveDocument(e.document.uri.fsPath)) {
        scheduleRefresh();
        outlineProvider?.refresh();
      }
    }),
    vscode.workspace.onDidSaveTextDocument((doc) => {
      if (isActiveDocument(doc.uri.fsPath)) {
        scheduleRefresh();
        outlineProvider?.refresh();
      }
    }),
    vscode.window.onDidChangeActiveTextEditor(() => {
      refreshStats();
      updateNovelContext(getConfig());
      outlineProvider?.refresh();
    }),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("japaneseFiction")) {
        refreshStats();
        outlineProvider?.refresh();
      }
    })
  );

  log("拡張機能 v0.2 が有効化されました");
  updateNovelContext(getConfig());
  refreshStats();
}

export function deactivate(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  statusBarItem.dispose();
}

function log(message: string): void {
  outputChannel.appendLine(`[${new Date().toLocaleTimeString("ja-JP")}] ${message}`);
}

function getConfig(): WorkFolderConfig & { targetPages: number } {
  const config = vscode.workspace.getConfiguration("japaneseFiction");

  return {
    targetPages: config.get<number>("targetPages", 400),
    novelRootSegment: config.get<string>("novelRootSegment", "小説"),
    draftFolderNames: config.get<string[]>("draftFolderNames", [
      "初稿",
      "第2稿",
      "第3稿",
      "最終稿",
    ]),
    settingsFolderName: config.get<string>("settingsFolderName", "設定"),
    manuscriptExcludeGlobs: config.get<string[]>("manuscriptExcludeGlobs", [
      "**/README*.md",
    ]),
    settings: {
      charsPerLine: config.get<number>("charsPerLine", 20),
      linesPerPage: config.get<number>("linesPerPage", 20),
    },
  };
}

function isActiveDocument(filePath: string): boolean {
  const config = getConfig();
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.uri.fsPath !== filePath) {
    return false;
  }
  return (
    isNovelMarkdownDocument(editor.document) &&
    resolveDraftFolderPath(
      filePath,
      config.draftFolderNames,
      config.settingsFolderName
    ) !== undefined
  );
}

function scheduleRefresh(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => refreshStats(), 500);
}

async function refreshStats(): Promise<void> {
  const editor = vscode.window.activeTextEditor;

  if (!editor) {
    hideStatusBar();
    return;
  }

  if (!isNovelMarkdownDocument(editor.document)) {
    hideStatusBar();
    return;
  }

  const filePath = editor.document.uri.fsPath;
  const config = getConfig();

  const draftFolderPath = resolveDraftFolderPath(
    filePath,
    config.draftFolderNames,
    config.settingsFolderName
  );
  const novelTitle = resolveNovelTitle(filePath, config.novelRootSegment);

  if (!draftFolderPath || !novelTitle) {
    hideStatusBar();
    return;
  }

  try {
    lastStats = await computeDraftStats(
      draftFolderPath,
      novelTitle,
      editor,
      config
    );
    updateStatusBar(lastStats, config.targetPages);
    log(
      `集計: ${lastStats.novelTitle} / ${lastStats.draftFolderName} → ${formatPages(lastStats.pages)}枚`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log(`集計エラー: ${message}`);
    hideStatusBar();
  }
}

async function computeDraftStats(
  draftFolderPath: string,
  novelTitle: string,
  activeEditor: vscode.TextEditor,
  config: WorkFolderConfig
): Promise<WorkManuscriptStats> {
  const filePaths = findMarkdownFilesRecursive(draftFolderPath);
  const fileContents = new Map<string, string>();

  for (const fsPath of filePaths) {
    if (activeEditor.document.uri.fsPath === fsPath) {
      fileContents.set(fsPath, activeEditor.document.getText());
    } else {
      fileContents.set(fsPath, readTextFile(fsPath));
    }
  }

  const activePath = activeEditor.document.uri.fsPath;
  if (
    activePath.startsWith(draftFolderPath) &&
    !fileContents.has(activePath)
  ) {
    filePaths.push(activePath);
    fileContents.set(activePath, activeEditor.document.getText());
  }

  if (filePaths.length === 0) {
    return emptyDraftStats(draftFolderPath, novelTitle, config.settings);
  }

  return analyzeDraftFolder(
    draftFolderPath,
    novelTitle,
    filePaths,
    fileContents,
    config
  );
}

function updateStatusBar(stats: WorkManuscriptStats, targetPages: number): void {
  const progress = (stats.pages / targetPages) * 100;
  const remaining = Math.max(0, targetPages - stats.pages);

  statusBarItem.text = `$(book) ${formatPages(stats.pages)}/${targetPages}枚 (${progress.toFixed(1)}%) | ${formatNumber(stats.totalChars)}字`;
  statusBarItem.tooltip = [
    `作品: ${stats.novelTitle}`,
    `稿: ${stats.draftFolderName}`,
    `換算枚数: ${formatPages(stats.pages)}枚（切上 ${stats.pagesRounded}枚）`,
    `目標: ${targetPages}枚（残り ${formatPages(remaining)}枚）`,
    `集計ファイル: ${stats.fileCount}件`,
    "",
    "クリックで詳細レポート",
  ].join("\n");
  statusBarItem.show();
}

function hideStatusBar(): void {
  statusBarItem.hide();
  lastStats = undefined;
}

async function showReport(): Promise<void> {
  if (!lastStats) {
    await refreshStats();
  }

  if (!lastStats) {
    vscode.window.showInformationMessage(
      "稿フォルダ内の Markdown ファイルを開いてください。"
    );
    return;
  }

  const config = getConfig();
  const targetPages = config.targetPages;
  const remaining = Math.max(0, targetPages - lastStats.pages);
  const progress = (lastStats.pages / targetPages) * 100;

  const fileLines = lastStats.files
    .map(
      (f) =>
        `  ${f.relativePath}: ${formatPages(f.pages)}枚 (${formatNumber(f.totalChars)}字)`
    )
    .join("\n");

  const message = [
    `【${lastStats.novelTitle} / ${lastStats.draftFolderName}】原稿用紙換算（400字詰め 20×20）`,
    "",
    `換算枚数: ${formatPages(lastStats.pages)}枚（切上 ${lastStats.pagesRounded}枚）`,
    `目標: ${targetPages}枚 → 進捗 ${progress.toFixed(1)}%（残り ${formatPages(remaining)}枚）`,
    `文字数: ${formatNumber(lastStats.totalChars)}字`,
    `集計範囲: ${lastStats.draftFolderName} 配下 ${lastStats.fileCount}件`,
    "",
    "── ファイル別 ──",
    fileLines || "  （対象ファイルなし）",
  ].join("\n");

  const doc = await vscode.workspace.openTextDocument({
    content: message,
    language: "plaintext",
  });
  await vscode.window.showTextDocument(doc, { preview: true });
}
