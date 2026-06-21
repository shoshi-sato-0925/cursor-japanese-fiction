import * as path from "path";
import * as vscode from "vscode";
import { findMarkdownFilesRecursive, readTextFile } from "./fileScanner";
import { extractHeadings, ManuscriptHeading } from "./headingParser";
import {
  filterManuscriptPaths,
  resolveDraftFolderPath,
  WorkFolderConfig,
} from "./workFolder";
import { jumpToTarget, NavigationTarget } from "./navigation";

type OutlineNodeKind = "file" | "chapter" | "section";

interface OutlineNodeData {
  kind: OutlineNodeKind;
  target: NavigationTarget;
  headings?: ManuscriptHeading[];
  filePath?: string;
  relativePath?: string;
  fileName?: string;
}

class OutlineTreeItem extends vscode.TreeItem {
  constructor(
    public readonly data: OutlineNodeData,
    collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(data.target.label, collapsibleState);
    this.description = data.target.description;
    this.tooltip = data.target.detail
      ? `${data.target.label}（${data.target.detail}）`
      : data.target.label;

    if (data.kind !== "file" || !data.headings || data.headings.length === 0) {
      this.command = {
        command: "japaneseFiction.outlineReveal",
        title: "ジャンプ",
        arguments: [data.target],
      };
    }

    this.contextValue = data.kind;
  }
}

export class ManuscriptOutlineProvider
  implements vscode.TreeDataProvider<OutlineTreeItem>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private getConfig: () => WorkFolderConfig) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: OutlineTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: OutlineTreeItem): Promise<OutlineTreeItem[]> {
    if (element) {
      return this.getHeadingChildren(element);
    }

    return this.getFileNodes();
  }

  private getActiveDraftContext():
    | {
        draftFolderPath: string;
        editor: vscode.TextEditor;
        config: WorkFolderConfig;
      }
    | undefined {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return undefined;
    }

    const config = this.getConfig();
    const filePath = editor.document.uri.fsPath;
    const draftFolderPath = resolveDraftFolderPath(
      filePath,
      config.draftFolderNames,
      config.settingsFolderName
    );

    if (!draftFolderPath) {
      return undefined;
    }

    return { draftFolderPath, editor, config };
  }

  private async getFileNodes(): Promise<OutlineTreeItem[]> {
    const ctx = this.getActiveDraftContext();
    if (!ctx) {
      return [];
    }

    const { draftFolderPath, editor, config } = ctx;
    const filePaths = findMarkdownFilesRecursive(draftFolderPath);
    const fileContents = new Map<string, string>();

    for (const fsPath of filePaths) {
      if (editor.document.uri.fsPath === fsPath) {
        fileContents.set(fsPath, editor.document.getText());
      } else {
        fileContents.set(fsPath, readTextFile(fsPath));
      }
    }

    const filtered = filterManuscriptPaths(
      draftFolderPath,
      filePaths,
      config.manuscriptExcludeGlobs
    );

    filtered.sort((a, b) =>
      path.basename(a).localeCompare(path.basename(b), "ja", { numeric: true })
    );

    const items: OutlineTreeItem[] = [];

    for (const fsPath of filtered) {
      const content = fileContents.get(fsPath);
      if (content === undefined) {
        continue;
      }

      const relativePath = path.relative(draftFolderPath, fsPath);
      const fileName = path.basename(fsPath);
      const headings = extractHeadings(content);

      const target: NavigationTarget = {
        label: fileName,
        description: relativePath,
        filePath: fsPath,
        line: headings[0]?.line ?? 0,
      };

      if (headings.length === 0) {
        items.push(
          new OutlineTreeItem(
            { kind: "file", target },
            vscode.TreeItemCollapsibleState.None
          )
        );
        continue;
      }

      items.push(
        new OutlineTreeItem(
          {
            kind: "file",
            target,
            headings,
            filePath: fsPath,
            relativePath,
            fileName,
          },
          vscode.TreeItemCollapsibleState.Collapsed
        )
      );
    }

    return items;
  }

  private getHeadingChildren(element: OutlineTreeItem): OutlineTreeItem[] {
    const { headings, filePath, fileName } = element.data;
    if (!headings || !filePath || !fileName) {
      return [];
    }

    return headings.map((heading) => {
      const kind: OutlineNodeKind = heading.level === 1 ? "chapter" : "section";

      return new OutlineTreeItem(
        {
          kind,
          target: {
            label: heading.text,
            description: fileName,
            detail: kind === "chapter" ? "章" : "節",
            filePath,
            line: heading.line,
          },
        },
        vscode.TreeItemCollapsibleState.None
      );
    });
  }
}

export function registerOutlineView(
  context: vscode.ExtensionContext,
  getConfig: () => WorkFolderConfig
): ManuscriptOutlineProvider {
  const provider = new ManuscriptOutlineProvider(getConfig);

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider(
      "japaneseFiction.outline",
      provider
    ),
    vscode.commands.registerCommand(
      "japaneseFiction.outlineReveal",
      (target: NavigationTarget) => jumpToTarget(target)
    ),
    vscode.commands.registerCommand("japaneseFiction.outlineRefresh", () =>
      provider.refresh()
    )
  );

  return provider;
}
