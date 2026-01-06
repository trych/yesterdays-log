import * as vscode from 'vscode';

const DEFAULT_DEBOUNCE_MS = 1000;

/**
 * Watches for file system changes and triggers refresh with debouncing.
 */
export class FileWatcher {
  private watcher: vscode.FileSystemWatcher | undefined;
  private debounceTimer: ReturnType<typeof setTimeout> | undefined;
  private debounceMs: number;
  private onChangeCallback: () => Promise<void>;
  private outputChannel: vscode.OutputChannel;
  private isRefreshing: boolean = false;

  constructor(
    onChangeCallback: () => Promise<void>,
    outputChannel: vscode.OutputChannel,
    debounceMs: number = DEFAULT_DEBOUNCE_MS
  ) {
    this.onChangeCallback = onChangeCallback;
    this.outputChannel = outputChannel;
    this.debounceMs = debounceMs;
  }

  /**
   * Start watching for file changes in the workspace.
   */
  start(): void {
    if (this.watcher) {
      return; // Already watching
    }

    // Watch all files in workspace
    this.watcher = vscode.workspace.createFileSystemWatcher('**/*');

    // React immediately to file creation/deletion (these affect visibility)
    this.watcher.onDidCreate(() => this.handleImmediateChange('created'));
    this.watcher.onDidDelete(() => this.handleImmediateChange('deleted'));
    // Debounce content changes (frequent during saves, don't affect our logic)
    this.watcher.onDidChange(() => this.handleDebouncedChange('changed'));

    this.log('File watcher started');
  }

  /**
   * Stop watching for file changes.
   */
  stop(): void {
    if (this.watcher) {
      this.watcher.dispose();
      this.watcher = undefined;
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }

    this.log('File watcher stopped');
  }

  /**
   * Handle file creation/deletion immediately (no debounce).
   */
  private handleImmediateChange(type: string): void {
    this.log(`File ${type}, triggering immediate refresh...`);

    // Clear any pending debounced refresh
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }

    // Trigger refresh immediately (but still prevent overlapping)
    if (this.isRefreshing) {
      this.log('Refresh already in progress, queuing...');
      // Queue another refresh after current one completes
      this.debounceTimer = setTimeout(() => this.handleImmediateChange(type), 100);
      return;
    }

    this.isRefreshing = true;
    this.onChangeCallback().finally(() => {
      this.isRefreshing = false;
    });
  }

  /**
   * Handle file content changes with debouncing.
   */
  private handleDebouncedChange(type: string): void {
    this.log(`File ${type}, scheduling debounced refresh...`);

    // Clear existing timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Set new debounce timer
    this.debounceTimer = setTimeout(async () => {
      if (this.isRefreshing) {
        this.log('Refresh already in progress, skipping');
        return;
      }

      this.isRefreshing = true;
      try {
        this.log('Debounce complete, triggering refresh');
        await this.onChangeCallback();
      } finally {
        this.isRefreshing = false;
      }
    }, this.debounceMs);
  }

  private log(message: string): void {
    this.outputChannel.appendLine(`[YesterdaysLog] ${message}`);
  }
}
