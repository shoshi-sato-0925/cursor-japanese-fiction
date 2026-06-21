import * as vscode from "vscode";

export interface InsertSymbolOptions {
  /** 左右のペア。カーソルは間に置く */
  pair?: [string, string];
  /** 単一文字列を挿入 */
  text?: string;
  /** 選択範囲がある場合にペアで囲む */
  wrapSelection?: boolean;
}

export async function insertSymbol(
  options: InsertSymbolOptions
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  const { pair, text, wrapSelection = true } = options;

  await editor.edit((editBuilder) => {
    for (const selection of editor.selections) {
      if (pair && wrapSelection && !selection.isEmpty) {
        const selected = editor.document.getText(selection);
        editBuilder.replace(selection, `${pair[0]}${selected}${pair[1]}`);
        continue;
      }

      if (pair) {
        editBuilder.insert(selection.active, `${pair[0]}${pair[1]}`);
        continue;
      }

      if (text !== undefined) {
        editBuilder.insert(selection.active, text);
      }
    }
  });

  if (pair) {
    const editorAfter = vscode.window.activeTextEditor;
    if (!editorAfter) {
      return;
    }

    const newSelections = editorAfter.selections.map((selection) => {
      if (!selection.isEmpty) {
        return selection;
      }

      const offset = pair[1].length;
      const anchor = selection.active.translate(0, -offset);
      return new vscode.Selection(anchor, anchor);
    });

    editorAfter.selections = newSelections;
  }
}

export async function insertDialogue(): Promise<void> {
  await insertSymbol({ pair: ["「", "」"] });
}

export async function insertInnerVoice(): Promise<void> {
  await insertSymbol({ pair: ["『", "』"] });
}

export async function insertEmDash(): Promise<void> {
  await insertSymbol({ text: "——" });
}

export async function insertEllipsis(): Promise<void> {
  await insertSymbol({ text: "……" });
}

/** 地の文の行頭（全角スペース）を挿入。行頭ならスペースのみ、それ以外は改行+スペース */
export async function insertNarrationLine(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  await editor.edit((editBuilder) => {
    for (const selection of editor.selections) {
      const line = editor.document.lineAt(selection.active.line);
      const atLineStart = selection.active.character === 0;
      const insertText = atLineStart ? "　" : "\n　";
      editBuilder.insert(selection.active, insertText);
    }
  });
}

export async function insertSceneBreak(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  await editor.edit((editBuilder) => {
    for (const selection of editor.selections) {
      editBuilder.insert(selection.active, "\n\n＊＊＊\n\n");
    }
  });
}

export function registerSymbolCommands(context: vscode.ExtensionContext): void {
  const commands: Array<[string, () => Promise<void>]> = [
    ["japaneseFiction.insertDialogue", insertDialogue],
    ["japaneseFiction.insertInnerVoice", insertInnerVoice],
    ["japaneseFiction.insertEmDash", insertEmDash],
    ["japaneseFiction.insertEllipsis", insertEllipsis],
    ["japaneseFiction.insertNarrationLine", insertNarrationLine],
    ["japaneseFiction.insertSceneBreak", insertSceneBreak],
  ];

  for (const [id, handler] of commands) {
    context.subscriptions.push(
      vscode.commands.registerCommand(id, handler)
    );
  }
}
