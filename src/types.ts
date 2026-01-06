export interface Rule {
  pattern: string;
  show: number | string;
  exclude?: string;
}

export interface FileInfo {
  uri: string;
  relativePath: string;
  mtime: number;
}

export interface ScanResult {
  folder: string;
  files: FileInfo[];
  show: number | string;
  exclude?: string;
}
