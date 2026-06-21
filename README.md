# Japanese Fiction Writing（cursor-japanese-fiction）

**GitHub:** https://github.com/shoshi-sato-0925/cursor-japanese-fiction  
**最新リリース:** https://github.com/shoshi-sato-0925/cursor-japanese-fiction/releases/latest

Cursor / VS Code 向けの **小説執筆支援拡張機能** です。

- **400字詰め原稿用紙** の換算枚数と進捗表示
- **章・節・ファイル** へのジャンプ
- 小説向け **記号のクイック挿入**

> 現在のバージョン: **v0.2.1**（v0.2 機能 + ジャンプショートカット修正）

エッセイ執筆向け（textlint 等）とは別に、**小説フォルダ内の Markdown** だけを対象に動作します。

---

## 動作環境

- **Cursor** または **Visual Studio Code** 1.85 以上
- macOS（開発・検証環境）。Windows / Linux でも VS Code 互換の範囲で動作する想定です
- 小説原稿は **Markdown**（`.md`）形式

---

## インストール

### 方法 A: VSIX ファイルから（推奨・共有に便利）

1. `cursor-japanese-fiction-0.2.1.vsix` を入手する
2. Cursor で `Cmd+Shift+P` → **「Extensions: Install from VSIX...」**
3. VSIX ファイルを選択
4. **「Developer: Reload Window」** でウィンドウをリロード

ターミナルからインストールする場合:

```bash
cursor --install-extension cursor-japanese-fiction-0.2.1.vsix
# VS Code の場合
# code --install-extension cursor-japanese-fiction-0.2.1.vsix
```

### 方法 B: ソースからビルド

```bash
git clone <リポジトリURL> cursor-japanese-fiction
cd cursor-japanese-fiction
npm install
npm run compile
npm run package
cursor --install-extension cursor-japanese-fiction-0.2.1.vsix
```

---

## フォルダ構成（前提）

拡張機能は次の vault 構成を前提にしています。

```
小説/
  {作品タイトル}/
    設定/              ← 集計・機能の対象外
    原稿/
      初稿/
      第2稿/
      第3稿/
      最終稿/          ← 執筆中の稿フォルダ
        第一章.md
        1.md
        ...
```

### 集計・ナビの単位

- **原稿用紙換算** と **小説ナビ** は、開いているファイルが属する **稿フォルダ**（初稿 / 第2稿 / 第3稿 / 最終稿）配下の `.md` を対象にします
- **設定/** フォルダ内のファイルは対象外です
- 旧構成（`小説/{作品}/第3稿/` のように `原稿/` なし）でも、稿フォルダ名が一致すれば動作します

### 見出しの書き方

| レベル | 用途 | 例 |
|--------|------|-----|
| `#` | 章 | `# 第一章` または `#第一章` |
| `##` | 節 | `## 一` または `##一` |

見出しを使わず **1.md, 2.md …** のようにファイル分割 only の原稿にも対応しています。

---

## 機能一覧

### 1. 原稿用紙換算（v0.1）

**稿フォルダ内の原稿テキスト** を、出版業界で一般的な **400字詰め（20字×20行）** 方式で換算します。

#### ステータスバー（右下）

```
47.7/400枚 (11.9%) | 14,575字
```

| 表示 | 意味 |
|------|------|
| `47.7/400枚` | 現在の換算枚数 / 目標枚数 |
| `(11.9%)` | 目標に対する進捗率 |
| `14,575字` | 行内空白（`　` 含む）を含む文字数 |

**クリック** → ファイル別の詳細レポートを表示

#### 換算ロジック

1. 原稿テキストのみを対象（以下は **除外**）
   - YAML frontmatter（`---` で囲まれたブロック）
   - Markdown 見出し行（`#` / `##`）
   - `[メタ情報]` 形式の行
2. 各行を **20字** で折り返し（超過分は複数行としてカウント）
3. **空行も 1 行** として消費
4. 換算行数 ÷ 20 = **枚数**

> 単純な「文字数 ÷ 400」ではありません。改行・段落の空行・行頭の `　` が反映されます。

#### コマンド

| コマンド | 説明 |
|---------|------|
| Japanese Fiction: 原稿用紙換算レポートを表示 | 詳細レポート |
| Japanese Fiction: 原稿換算を再計算 | 手動で再集計 |

---

### 2. 章・節ジャンプ（v0.2）

#### ショートカット

| 操作 | macOS |
|------|-------|
| 稿フォルダ全体からジャンプ | **`Cmd+Shift+J`** |

> **注意（JIS キーボード）:** `Cmd+Option+J` は Option+字母が特殊文字入力に取られるため **使えません**。v0.2.1 以降は `Cmd+Shift+J` が正式な割り当てです。

#### コマンドパレット

| コマンド | 説明 |
|---------|------|
| 章・節へジャンプ（稿フォルダ全体） | 全 `.md` ファイル・章・節の一覧からジャンプ |
| 章・節へジャンプ（このファイル内） | 現在ファイルの見出しのみ |

#### 小説ナビ（サイドバー）

原稿ファイルを開いているとき、エクスプローラー下部に **「小説ナビ」** が表示されます。

- ファイル一覧
- ファイル内の `#` 章 / `##` 節（展開可能）
- 項目をクリック → 該当箇所へジャンプ

---

### 3. 記号クイック挿入（v0.2）

#### ショートカット（macOS）

| ショートカット | 挿入内容 | 備考 |
|--------------|---------|------|
| `Cmd+Alt+9` | `「」` | 選択範囲があれば囲む。カーソルは `「|」` の間 |
| `Cmd+Alt+8` | `『』` | 心の声・AI セリフ等 |
| `Cmd+Alt+-` | `——` | em ダッシュ |
| `Cmd+Alt+.` | `……` | 三点リーダー |
| `Cmd+Alt+Enter` | `　` または `\n　` | 地の文の行頭。行頭ならスペースのみ、それ以外は改行+スペース |

#### 右クリックメニュー

エディタ内で右クリック → **「小説記号を挿入」**

- `「」` `『』` `——` `……`
- 地の文行（`　`）
- 場面区切り（`＊＊＊`）

---

## 設定

`Cmd+,` → 検索欄に `japaneseFiction` と入力。

| 設定キー | デフォルト | 説明 |
|---------|-----------|------|
| `japaneseFiction.targetPages` | `400` | 目標原稿用紙枚数 |
| `japaneseFiction.draftFolderNames` | `["初稿","第2稿","第3稿","最終稿"]` | 稿フォルダ名 |
| `japaneseFiction.settingsFolderName` | `"設定"` | 除外する設定フォルダ名 |
| `japaneseFiction.novelRootSegment` | `"小説"` | 作品フォルダの親ディレクトリ名 |
| `japaneseFiction.charsPerLine` | `20` | 1行あたりの字数 |
| `japaneseFiction.linesPerPage` | `20` | 1枚あたりの行数 |
| `japaneseFiction.manuscriptExcludeGlobs` | `["**/README*.md"]` | 稿フォルダ内で集計除外する glob |

### 設定例（作品ごとに目標枚数を変える）

ワークスペースの `.vscode/settings.json`:

```json
{
  "japaneseFiction.targetPages": 300
}
```

---

## ショートカットのカスタマイズ

`Cmd+K Cmd+S` → `Japanese Fiction` で検索。

または `~/Library/Application Support/Cursor/User/keybindings.json` に追加:

```json
{
  "key": "cmd+alt+]",
  "command": "japaneseFiction.jumpToSection",
  "when": "editorTextFocus && japaneseFiction.isNovelManuscript"
}
```

---

## トラブルシューティング

### ステータスバーが表示されない

1. 拡張がインストールされているか確認（Extensions → **Japanese Fiction Writing**）
2. **稿フォルダ内** の `.md` を開いているか確認（`設定/` 内は対象外）
3. ウィンドウをリロード
4. Output → **Japanese Fiction** にログが出るか確認

### gitignore で原稿が無視されている vault でも動くか

**動きます。** v0.1 以降、原稿ファイルは `fs` 経由で直接読み込むため、Obsidian Sync 等で `.gitignore` されている vault でも集計できます。

### ジャンプのショートカットが効かない

- コマンドパレットから「章・節へジャンプ」が動くか確認
- JIS キーボードでは **`Cmd+Shift+J`** を使う（`Cmd+Option+J` は不可）
- `Cmd+K Cmd+S` で競合を確認

---

## 更新方法

```bash
cd ~/dev/cursor-japanese-fiction
git pull          # リポジトリを使っている場合
npm run compile
npm run package
cursor --install-extension cursor-japanese-fiction-0.2.1.vsix
```

インストール後、Cursor をリロードしてください。

---

## 他の人と共有する方法

### 1. VSIX ファイルを渡す（いちばん簡単）

```bash
cd ~/dev/cursor-japanese-fiction
npm run package
```

生成される **`cursor-japanese-fiction-0.2.1.vsix`** を相手に渡します。

- メール添付、クラウドストレージ（Dropbox / iCloud / Google Drive）
- USB メモリ

相手側の手順:

1. VSIX をダウンロード
2. Cursor → `Cmd+Shift+P` → **Extensions: Install from VSIX...**
3. リロード

### 2. GitHub 等のリポジトリで公開

```bash
cd ~/dev/cursor-japanese-fiction
git init
git add .
git commit -m "Initial release v0.2.1"
git remote add origin <GitHub URL>
git push -u origin main
```

**GitHub Releases** に VSIX を添付すると便利です。

1. GitHub → Releases → **Create a new release**
2. Tag: `v0.2.1`
3. `cursor-japanese-fiction-0.2.1.vsix` をドラッグ&ドロップ
4. リリースノートにこの README のリンクを記載

### 3. 社内・友人向けに README だけ共有

この `README.md` をそのまま渡せば、インストール手順と使い方が伝わります。

---

## 開発

```bash
npm install
npm run watch          # TypeScript の自動コンパイル
npm test               # ユニットテスト
```

Cursor で `~/dev/cursor-japanese-fiction` を開き **F5** → Extension Development Host が起動します。

---

## バージョン履歴

| 版 | 主な内容 |
|----|---------|
| v0.1 | 400字詰め原稿用紙換算、ステータスバー、進捗表示 |
| v0.2 | 章・節ジャンプ、小説ナビ、記号クイック挿入 |
| v0.2.1 | ジャンプショートカットを `Cmd+Shift+J` に変更（JIS キーボード対応） |

---

## ライセンス

MIT License（`LICENSE` 参照）
