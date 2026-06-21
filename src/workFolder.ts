import * as path from "path";
import {
  analyzeManuscriptText,
  ManuscriptSettings,
  mergeStats,
  WorkManuscriptStats,
  ManuscriptFileStats,
} from "./manuscriptCounter";

export interface WorkFolderConfig {
  novelRootSegment: string;
  draftFolderNames: string[];
  settingsFolderName: string;
  manuscriptExcludeGlobs: string[];
  settings: ManuscriptSettings;
}

export const DEFAULT_DRAFT_FOLDER_NAMES = [
  "初稿",
  "第2稿",
  "第3稿",
  "最終稿",
];

/** 設定フォルダ配下かどうか */
export function isUnderSettingsFolder(
  filePath: string,
  settingsFolderName: string
): boolean {
  const parts = path.normalize(filePath).split(path.sep);
  return parts.includes(settingsFolderName);
}

/** ファイルパスから作品タイトル（小説/{作品名}/）を特定する */
export function resolveNovelTitle(
  filePath: string,
  novelRootSegment: string
): string | undefined {
  const parts = path.normalize(filePath).split(path.sep);
  const rootIndex = parts.indexOf(novelRootSegment);

  if (rootIndex === -1 || rootIndex + 1 >= parts.length) {
    return undefined;
  }

  return parts[rootIndex + 1];
}

/**
 * ファイルが属する稿フォルダ（初稿/第2稿/第3稿/最終稿）を特定する。
 * 稿フォルダ配下のすべての .md が集計対象になる。
 */
export function resolveDraftFolderPath(
  filePath: string,
  draftFolderNames: string[],
  settingsFolderName: string
): string | undefined {
  if (isUnderSettingsFolder(filePath, settingsFolderName)) {
    return undefined;
  }

  const parts = path.normalize(filePath).split(path.sep);

  for (let i = parts.length - 2; i >= 0; i--) {
    if (draftFolderNames.includes(parts[i])) {
      return parts.slice(0, i + 1).join(path.sep);
    }
  }

  return undefined;
}

export function getDraftFolderName(draftFolderPath: string): string {
  return path.basename(draftFolderPath);
}

function relativeToDraftFolder(
  draftFolderPath: string,
  filePath: string
): string {
  return path.relative(draftFolderPath, filePath);
}

/** 簡易 glob マッチ（除外パターン用） */
export function matchGlob(normalizedPath: string, glob: string): boolean {
  const normalized = normalizedPath.split(path.sep).join("/");
  const regex = globToRegex(glob.split(path.sep).join("/"));
  return regex.test(normalized);
}

function globToRegex(glob: string): RegExp {
  let pattern = glob.split(path.sep).join("/");
  pattern = pattern.replace(/\./g, "\\.");
  pattern = pattern.replace(/\*\*\//g, "(?:.*/)?");
  pattern = pattern.replace(/\/\*\*/g, "(?:/.*)?");
  pattern = pattern.replace(/\*\*/g, ".*");
  pattern = pattern.replace(/\*/g, "[^/]*");
  return new RegExp(`^${pattern}$`);
}

function shouldExcludeFile(
  relativePath: string,
  excludeGlobs: string[]
): boolean {
  const normalized = relativePath.split(path.sep).join("/");

  return excludeGlobs.some((glob) => matchGlob(normalized, glob));
}

export function filterManuscriptPaths(
  draftFolderPath: string,
  filePaths: string[],
  excludeGlobs: string[]
): string[] {
  return filePaths.filter((filePath) => {
    const relative = relativeToDraftFolder(draftFolderPath, filePath);

    if (!filePath.endsWith(".md")) {
      return false;
    }

    if (shouldExcludeFile(relative, excludeGlobs)) {
      return false;
    }

    return true;
  });
}

export async function analyzeDraftFolder(
  draftFolderPath: string,
  novelTitle: string,
  filePaths: string[],
  fileContents: Map<string, string>,
  config: WorkFolderConfig
): Promise<WorkManuscriptStats> {
  const filtered = filterManuscriptPaths(
    draftFolderPath,
    filePaths,
    config.manuscriptExcludeGlobs
  );

  const fileStats: ManuscriptFileStats[] = [];

  for (const filePath of filtered) {
    const content = fileContents.get(filePath);
    if (content === undefined) {
      continue;
    }

    const stats = analyzeManuscriptText(content, config.settings);
    fileStats.push({
      ...stats,
      relativePath: relativeToDraftFolder(draftFolderPath, filePath),
    });
  }

  fileStats.sort((a, b) => a.relativePath.localeCompare(b.relativePath, "ja"));

  const merged = mergeStats(fileStats, config.settings);

  return {
    ...merged,
    novelTitle,
    draftFolderName: getDraftFolderName(draftFolderPath),
    draftFolderPath,
    fileCount: fileStats.length,
    files: fileStats,
  };
}

export function emptyDraftStats(
  draftFolderPath: string,
  novelTitle: string,
  settings: ManuscriptSettings
): WorkManuscriptStats {
  const charsPerPage = settings.charsPerLine * settings.linesPerPage;

  return {
    novelTitle,
    draftFolderName: getDraftFolderName(draftFolderPath),
    draftFolderPath,
    fileCount: 0,
    files: [],
    rawLines: 0,
    emptyLines: 0,
    totalLines: 0,
    totalChars: 0,
    pages: 0,
    pagesRounded: 0,
    charsPerLine: settings.charsPerLine,
    linesPerPage: settings.linesPerPage,
    charsPerPage,
  };
}

export function isUnderNovelRoot(
  filePath: string,
  novelRootSegment: string
): boolean {
  const parts = path.normalize(filePath).split(path.sep);
  return parts.includes(novelRootSegment);
}

export function isCountableManuscriptFile(
  filePath: string,
  config: WorkFolderConfig
): boolean {
  if (!isUnderNovelRoot(filePath, config.novelRootSegment)) {
    return false;
  }

  if (isUnderSettingsFolder(filePath, config.settingsFolderName)) {
    return false;
  }

  return (
    resolveDraftFolderPath(
      filePath,
      config.draftFolderNames,
      config.settingsFolderName
    ) !== undefined
  );
}
