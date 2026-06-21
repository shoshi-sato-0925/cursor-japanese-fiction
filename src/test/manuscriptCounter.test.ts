import {
  analyzeManuscriptText,
  extractManuscriptLines,
  isManuscriptLine,
  countLineWidth,
} from "../manuscriptCounter";
import {
  matchGlob,
  resolveDraftFolderPath,
  resolveNovelTitle,
  isUnderSettingsFolder,
  isCountableManuscriptFile,
} from "../workFolder";
import {
  parseHeadingLine,
  extractHeadings,
  formatHeadingLabel,
} from "../headingParser";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}`);
    throw err;
  }
}

const config = {
  novelRootSegment: "小説",
  draftFolderNames: ["初稿", "第2稿", "第3稿", "最終稿"],
  settingsFolderName: "設定",
  manuscriptExcludeGlobs: ["**/README*.md"],
  settings: { charsPerLine: 20, linesPerPage: 20 },
};

test("extractManuscriptLines: frontmatter を除外", () => {
  const content = `---
title: test
---
# 第一章
　本文です。
[入居者情報]
メモ行`;
  const lines = extractManuscriptLines(content);
  assert.equal(lines.length, 2);
  assert.equal(lines[0], "　本文です。");
  assert.equal(lines[1], "メモ行");
});

test("isManuscriptLine: 見出しを除外", () => {
  assert.equal(isManuscriptLine("# 第一章"), false);
  assert.equal(isManuscriptLine("#第一章"), false);
  assert.equal(isManuscriptLine("## 一"), false);
  assert.equal(isManuscriptLine("　地の文"), true);
});

test("countLineWidth: 20字折り返し", () => {
  assert.equal(countLineWidth("", 20), 1);
  assert.equal(countLineWidth("a".repeat(20), 20), 1);
  assert.equal(countLineWidth("a".repeat(21), 20), 2);
});

test("matchGlob: 除外パターン", () => {
  assert.equal(matchGlob("tools/foo.md", "**/tools/**"), true);
  assert.equal(matchGlob("README.md", "**/README*.md"), true);
  assert.equal(matchGlob("第一章.md", "**/README*.md"), false);
});

test("resolveDraftFolderPath: 原稿/第3稿 構成", () => {
  const p = resolveDraftFolderPath(
    "/Users/tsato/vaults/tsatovault/小説/復活の呪文/原稿/第3稿/第一章.md",
    config.draftFolderNames,
    config.settingsFolderName
  );
  assert.equal(
    p,
    "/Users/tsato/vaults/tsatovault/小説/復活の呪文/原稿/第3稿"
  );
});

test("resolveDraftFolderPath: 旧構成（原稿なし）も第3稿を検出", () => {
  const p = resolveDraftFolderPath(
    "/Users/tsato/vaults/tsatovault/小説/復活の呪文/第3稿/第一章.md",
    config.draftFolderNames,
    config.settingsFolderName
  );
  assert.equal(p, "/Users/tsato/vaults/tsatovault/小説/復活の呪文/第3稿");
});

test("resolveDraftFolderPath: 設定フォルダは対象外", () => {
  const p = resolveDraftFolderPath(
    "/Users/tsato/vaults/tsatovault/小説/復活の呪文/設定/キャラ.md",
    config.draftFolderNames,
    config.settingsFolderName
  );
  assert.equal(p, undefined);
});

test("isUnderSettingsFolder", () => {
  assert.equal(
    isUnderSettingsFolder(
      "/Users/tsato/vaults/tsatovault/小説/作品/設定/foo.md",
      "設定"
    ),
    true
  );
});

test("isCountableManuscriptFile", () => {
  assert.equal(
    isCountableManuscriptFile(
      "/Users/tsato/vaults/tsatovault/小説/復活の呪文/第3稿/第一章.md",
      config
    ),
    true
  );
  assert.equal(
    isCountableManuscriptFile(
      "/Users/tsato/vaults/tsatovault/小説/復活の呪文/設定/基本.md",
      config
    ),
    false
  );
  assert.equal(
    isCountableManuscriptFile(
      "/Users/tsato/vaults/tsatovault/小説/復活の呪文/00_基本設定.md",
      config
    ),
    false
  );
});

test("resolveNovelTitle", () => {
  assert.equal(
    resolveNovelTitle(
      "/Users/tsato/vaults/tsatovault/小説/復活の呪文/原稿/第3稿/第一章.md",
      "小説"
    ),
    "復活の呪文"
  );
});

test("parseHeadingLine: スペースあり・なし", () => {
  assert.deepEqual(parseHeadingLine("# 第一章"), {
    level: 1,
    text: "第一章",
    line: 0,
  });
  assert.deepEqual(parseHeadingLine("#第一章"), {
    level: 1,
    text: "第一章",
    line: 0,
  });
  assert.deepEqual(parseHeadingLine("## 一"), {
    level: 2,
    text: "一",
    line: 0,
  });
  assert.deepEqual(parseHeadingLine("##一"), {
    level: 2,
    text: "一",
    line: 0,
  });
  assert.equal(parseHeadingLine("　地の文"), null);
});

test("extractHeadings", () => {
  const content = `#第一章\n\n##一\n\n本文\n\n##二\n`;
  const headings = extractHeadings(content);
  assert.equal(headings.length, 3);
  assert.equal(headings[0].text, "第一章");
  assert.equal(headings[1].text, "一");
  assert.equal(formatHeadingLabel(headings[1], "第一章.md"), "第一章.md › 節: 一");
});

const chapterPath =
  "/Users/tsato/vaults/tsatovault/小説/復活の呪文/第3稿/第一章.md";
if (fs.existsSync(chapterPath)) {
  test("第一章.md: 20×20 換算（原稿のみ）", () => {
    const content = fs.readFileSync(chapterPath, "utf-8");
    const stats = analyzeManuscriptText(content, {
      charsPerLine: 20,
      linesPerPage: 20,
    });
    console.log(
      `  → ${stats.pages.toFixed(2)}枚, ${stats.totalChars}字, ${stats.totalLines}行`
    );
    assert.ok(stats.pages > 40 && stats.pages < 55);
  });
}

console.log("\nAll tests passed.");
