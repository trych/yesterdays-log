import * as vscode from 'vscode';
import { minimatch } from 'minimatch';
import { Rule, FileInfo, ScanResult } from './types';
import * as config from './config';

const MAX_DEPTH = 20;

/**
 * Scans workspace folders for directories matching the given rules
 * and returns file information for each matching directory.
 */
export async function scanWorkspace(rules: Rule[]): Promise<ScanResult[]> {
  const results: ScanResult[] = [];
  const workspaceFolders = vscode.workspace.workspaceFolders;

  if (!workspaceFolders || rules.length === 0) {
    return results;
  }

  for (const wsFolder of workspaceFolders) {
    const matchingFolders = await findMatchingFolders(wsFolder.uri, rules);

    for (const { folderUri, rule } of matchingFolders) {
      const files = await getFilesInFolder(folderUri, wsFolder.uri);
      results.push({
        folder: folderUri.fsPath,
        files,
        show: rule.show,
        exclude: rule.exclude
      });
    }
  }

  return results;
}

/**
 * Find folders matching any of the given rules within a workspace folder.
 */
async function findMatchingFolders(
  workspaceUri: vscode.Uri,
  rules: Rule[]
): Promise<Array<{ folderUri: vscode.Uri; rule: Rule }>> {
  const matches: Array<{ folderUri: vscode.Uri; rule: Rule }> = [];

  async function searchDirectory(dirUri: vscode.Uri, depth: number = 0): Promise<void> {
    // Limit recursion depth to avoid performance issues
    if (depth > MAX_DEPTH) {
      return;
    }

    const relativePath = getRelativePath(workspaceUri, dirUri);

    // Check if this directory matches any rule
    for (const rule of rules) {
      if (matchesPattern(relativePath, rule.pattern)) {
        matches.push({ folderUri: dirUri, rule });
        // Don't recurse into matched folders
        return;
      }
    }

    // Recurse into subdirectories
    try {
      const entries = await vscode.workspace.fs.readDirectory(dirUri);
      for (const [name, type] of entries) {
        if (type === vscode.FileType.Directory && !shouldSkipDirectory(name)) {
          const childUri = vscode.Uri.joinPath(dirUri, name);
          await searchDirectory(childUri, depth + 1);
        }
      }
    } catch (error) {
      // Log but continue - permission errors are common
      console.debug(`[RecentFilesOnly] Could not read directory ${dirUri.fsPath}: ${error}`);
    }
  }

  await searchDirectory(workspaceUri);
  return matches;
}

/**
 * Get all files in a folder with their modification times.
 */
async function getFilesInFolder(
  folderUri: vscode.Uri,
  workspaceUri: vscode.Uri
): Promise<FileInfo[]> {
  const files: FileInfo[] = [];

  try {
    const entries = await vscode.workspace.fs.readDirectory(folderUri);

    for (const [name, type] of entries) {
      if (type === vscode.FileType.File) {
        const fileUri = vscode.Uri.joinPath(folderUri, name);
        try {
          const stat = await vscode.workspace.fs.stat(fileUri);
          files.push({
            uri: fileUri.toString(),
            relativePath: getRelativePath(workspaceUri, fileUri),
            mtime: stat.mtime
          });
        } catch (error) {
          console.debug(`[RecentFilesOnly] Could not stat file ${fileUri.fsPath}: ${error}`);
        }
      }
    }
  } catch (error) {
    console.debug(`[RecentFilesOnly] Could not read folder ${folderUri.fsPath}: ${error}`);
  }

  return files;
}

/**
 * Get relative path from workspace root to a URI.
 */
function getRelativePath(workspaceUri: vscode.Uri, targetUri: vscode.Uri): string {
  const workspacePath = workspaceUri.fsPath;
  const targetPath = targetUri.fsPath;

  if (targetPath.startsWith(workspacePath)) {
    let relative = targetPath.slice(workspacePath.length);
    // Remove leading slash/backslash
    if (relative.startsWith('/') || relative.startsWith('\\')) {
      relative = relative.slice(1);
    }
    return relative || '.';
  }

  return targetPath;
}

/**
 * Check if a relative path matches a glob pattern.
 */
function matchesPattern(relativePath: string, pattern: string): boolean {
  // Normalize path separators
  const normalizedPath = relativePath.replace(/\\/g, '/');
  const normalizedPattern = pattern.replace(/\\/g, '/');

  return minimatch(normalizedPath, normalizedPattern, {
    matchBase: true,
    dot: true
  });
}

/**
 * Directories to skip when scanning (common uninteresting directories).
 */
function shouldSkipDirectory(name: string): boolean {
  const skipDirs = [
    'node_modules',
    '.git',
    '.svn',
    '.hg',
    '__pycache__',
    '.vscode',
    '.idea'
  ];
  return skipDirs.includes(name);
}

/**
 * Parse a duration string like "7d", "2w", "3M" into milliseconds.
 */
function parseDuration(duration: string): number | null {
  const match = duration.match(/^(\d+)([mhdwMy])$/);
  if (!match) {
    return null;
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  const multipliers: Record<string, number> = {
    'm': 60 * 1000,                    // minutes
    'h': 60 * 60 * 1000,               // hours
    'd': 24 * 60 * 60 * 1000,          // days
    'w': 7 * 24 * 60 * 60 * 1000,      // weeks
    'M': 30 * 24 * 60 * 60 * 1000,     // months (approx 30 days)
    'y': 365 * 24 * 60 * 60 * 1000,    // years (approx 365 days)
  };

  return value * multipliers[unit];
}

/**
 * Check if a filename matches an exclude pattern.
 */
function matchesExcludePattern(filename: string, excludePattern: string): boolean {
  return minimatch(filename, excludePattern, { matchBase: true, dot: true });
}

/**
 * Get patterns from VS Code's files.exclude that are NOT managed by us.
 */
function getExternalExcludePatterns(): string[] {
  const filesConfig = vscode.workspace.getConfiguration('files');
  const allExcludes = filesConfig.get<Record<string, boolean>>('exclude') || {};
  const managedExclusions = config.getManagedExclusions();

  // Return patterns that are enabled and not managed by us
  return Object.entries(allExcludes)
    .filter(([pattern, enabled]) => enabled && !(pattern in managedExclusions))
    .map(([pattern]) => pattern);
}

/**
 * Check if a file path matches any of VS Code's external exclude patterns.
 */
function isExcludedByVSCode(relativePath: string): boolean {
  const patterns = getExternalExcludePatterns();
  const filename = relativePath.split(/[/\\]/).pop() || '';

  for (const pattern of patterns) {
    if (minimatch(relativePath, pattern, { matchBase: true, dot: true }) ||
        minimatch(filename, pattern, { matchBase: true, dot: true })) {
      return true;
    }
  }
  return false;
}

/**
 * Determine which files should be hidden based on scan results.
 * Returns relative paths of files to hide.
 */
export function getFilesToHide(scanResults: ScanResult[]): string[] {
  const filesToHide: string[] = [];

  for (const result of scanResults) {
    // Separate files into excluded and candidates
    const excludedFiles: FileInfo[] = [];
    const candidateFiles: FileInfo[] = [];

    for (const file of result.files) {
      // Skip files already hidden by VS Code's files.exclude
      if (isExcludedByVSCode(file.relativePath)) {
        continue;
      }

      const filename = file.relativePath.split(/[/\\]/).pop() || '';
      if (result.exclude && matchesExcludePattern(filename, result.exclude)) {
        excludedFiles.push(file);
      } else {
        candidateFiles.push(file);
      }
    }

    // Always hide excluded files
    for (const file of excludedFiles) {
      filesToHide.push(file.relativePath);
    }

    // Sort candidate files by modification time (newest first)
    const sortedFiles = [...candidateFiles].sort((a, b) => b.mtime - a.mtime);

    // Determine which files to hide based on show value
    let toHide: FileInfo[];

    // Normalize show value - handle string numbers from settings
    const showValue = typeof result.show === 'string' && /^\d+$/.test(result.show)
      ? parseInt(result.show, 10)
      : result.show;

    if (typeof showValue === 'number') {
      // Count-based: hide all but the N newest
      toHide = sortedFiles.slice(showValue);
    } else {
      // Age-based: hide files older than the duration
      const durationMs = parseDuration(showValue);
      if (durationMs === null) {
        console.warn(`[RecentFilesOnly] Invalid duration: ${showValue}`);
        toHide = [];
      } else {
        const cutoffTime = Date.now() - durationMs;
        toHide = sortedFiles.filter(file => file.mtime < cutoffTime);
      }
    }

    for (const file of toHide) {
      filesToHide.push(file.relativePath);
    }
  }

  return filesToHide;
}
