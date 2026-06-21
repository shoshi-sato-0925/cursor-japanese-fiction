export type HeadingLevel = 1 | 2;

export interface ManuscriptHeading {
  level: HeadingLevel;
  text: string;
  line: number;
}

/** `# 章` / `#章` / `## 節` / `##節` を解析 */
export function parseHeadingLine(line: string): ManuscriptHeading | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("#")) {
    return null;
  }

  const withSpace = trimmed.match(/^(#{1,2})\s+(.+)$/);
  if (withSpace) {
    const level = withSpace[1].length as HeadingLevel;
    if (level > 2) {
      return null;
    }
    return { level, text: withSpace[2].trim(), line: 0 };
  }

  const withoutSpace = trimmed.match(/^(#{1,2})([^\s#].*)$/);
  if (withoutSpace) {
    const level = withoutSpace[1].length as HeadingLevel;
    if (level > 2) {
      return null;
    }
    return { level, text: withoutSpace[2].trim(), line: 0 };
  }

  return null;
}

export function extractHeadings(content: string): ManuscriptHeading[] {
  const lines = content.split("\n");
  const headings: ManuscriptHeading[] = [];

  for (let i = 0; i < lines.length; i++) {
    const parsed = parseHeadingLine(lines[i]);
    if (parsed) {
      headings.push({ ...parsed, line: i });
    }
  }

  return headings;
}

export function formatHeadingLabel(
  heading: ManuscriptHeading,
  prefix?: string
): string {
  const kind = heading.level === 1 ? "章" : "節";
  const base = `${kind}: ${heading.text}`;
  return prefix ? `${prefix} › ${base}` : base;
}
