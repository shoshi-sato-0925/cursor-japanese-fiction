import * as fs from "fs";
import * as path from "path";

/** gitignore 対象でも稿フォルダ内の .md を列挙する */
export function findMarkdownFilesRecursive(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const results: string[] = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      results.push(...findMarkdownFilesRecursive(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      results.push(fullPath);
    }
  }

  return results;
}

export function readTextFile(filePath: string): string {
  return fs.readFileSync(filePath, "utf-8");
}
