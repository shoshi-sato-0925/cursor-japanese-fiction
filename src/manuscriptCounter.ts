export interface ManuscriptSettings {
  charsPerLine: number;
  linesPerPage: number;
}

export interface ManuscriptStats {
  rawLines: number;
  emptyLines: number;
  totalLines: number;
  totalChars: number;
  pages: number;
  pagesRounded: number;
  charsPerLine: number;
  linesPerPage: number;
  charsPerPage: number;
}

export interface ManuscriptFileStats extends ManuscriptStats {
  relativePath: string;
}

export interface WorkManuscriptStats extends ManuscriptStats {
  novelTitle: string;
  draftFolderName: string;
  draftFolderPath: string;
  fileCount: number;
  files: ManuscriptFileStats[];
}

/** 原稿テキスト行かどうか（メタデータ・見出しを除外） */
export function isManuscriptLine(line: string): boolean {
  const trimmed = line.trim();

  if (trimmed.length === 0) {
    return true;
  }

  if (/^#{1,6}\s*/.test(trimmed)) {
    return false;
  }

  if (/^#{1,6}[^\s#]/.test(trimmed)) {
    return false;
  }

  if (/^\[.+\]$/.test(trimmed)) {
    return false;
  }

  if (trimmed.startsWith("<!--") && trimmed.endsWith("-->")) {
    return false;
  }

  return true;
}

/** frontmatter ブロックを除いた原稿行を返す */
export function extractManuscriptLines(content: string): string[] {
  const lines = content.split("\n");
  const result: string[] = [];
  let inFrontmatter = false;
  let frontmatterDone = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!frontmatterDone) {
      if (i === 0 && line.trim() === "---") {
        inFrontmatter = true;
        continue;
      }
      if (inFrontmatter) {
        if (line.trim() === "---") {
          inFrontmatter = false;
          frontmatterDone = true;
        }
        continue;
      }
      frontmatterDone = true;
    }

    if (isManuscriptLine(line)) {
      result.push(line);
    }
  }

  return result;
}

export function countLineWidth(line: string, charsPerLine: number): number {
  if (line.length === 0) {
    return 1;
  }
  return Math.ceil(line.length / charsPerLine);
}

export function analyzeManuscriptText(
  content: string,
  settings: ManuscriptSettings
): ManuscriptStats {
  const { charsPerLine, linesPerPage } = settings;
  const lines = extractManuscriptLines(content);

  let totalLines = 0;
  let emptyLines = 0;
  let totalChars = 0;

  for (const line of lines) {
    totalChars += line.length;
    const consumed = countLineWidth(line, charsPerLine);
    totalLines += consumed;

    if (line.length === 0) {
      emptyLines += 1;
    }
  }

  const pages = totalLines / linesPerPage;
  const charsPerPage = charsPerLine * linesPerPage;

  return {
    rawLines: lines.length,
    emptyLines,
    totalLines,
    totalChars,
    pages,
    pagesRounded: Math.ceil(pages),
    charsPerLine,
    linesPerPage,
    charsPerPage,
  };
}

export function mergeStats(
  parts: ManuscriptStats[],
  settings: ManuscriptSettings
): ManuscriptStats {
  const { charsPerLine, linesPerPage } = settings;
  const charsPerPage = charsPerLine * linesPerPage;

  const merged = parts.reduce(
    (acc, part) => ({
      rawLines: acc.rawLines + part.rawLines,
      emptyLines: acc.emptyLines + part.emptyLines,
      totalLines: acc.totalLines + part.totalLines,
      totalChars: acc.totalChars + part.totalChars,
    }),
    { rawLines: 0, emptyLines: 0, totalLines: 0, totalChars: 0 }
  );

  const pages = merged.totalLines / linesPerPage;

  return {
    ...merged,
    pages,
    pagesRounded: Math.ceil(pages),
    charsPerLine,
    linesPerPage,
    charsPerPage,
  };
}

export function formatNumber(n: number): string {
  return n.toLocaleString("ja-JP");
}

export function formatPages(pages: number): string {
  return pages.toFixed(1);
}
