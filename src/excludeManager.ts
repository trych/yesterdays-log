import * as vscode from 'vscode';
import * as config from './config';

/**
 * Manages the files.exclude configuration, merging our exclusions
 * with user-defined patterns.
 */
export class ExcludeManager {
  private outputChannel: vscode.OutputChannel;

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
  }

  /**
   * Update files.exclude with new exclusion patterns for hidden files.
   * Preserves user-defined exclusions and only manages our own patterns.
   */
  async updateExclusions(filesToHide: string[]): Promise<void> {
    const filesConfig = vscode.workspace.getConfiguration('files');

    // Get current files.exclude (includes both user and our patterns)
    const currentExclude = filesConfig.get<Record<string, boolean>>('exclude') || {};

    // Get our previously managed exclusions
    const previousManagedExclusions = config.getManagedExclusions();

    // Create new managed exclusions from files to hide
    const newManagedExclusions: Record<string, boolean> = {};
    for (const file of filesToHide) {
      newManagedExclusions[file] = true;
    }

    // Calculate what needs to be removed (old managed patterns no longer needed)
    const toRemove = new Set(Object.keys(previousManagedExclusions));
    for (const pattern of Object.keys(newManagedExclusions)) {
      toRemove.delete(pattern);
    }

    // Build new files.exclude
    const newExclude: Record<string, boolean> = { ...currentExclude };

    for (const pattern of toRemove) {
      delete newExclude[pattern];
    }

    for (const [pattern, value] of Object.entries(newManagedExclusions)) {
      newExclude[pattern] = value;
    }

    if (!this.areEqual(currentExclude, newExclude)) {
      try {
        await filesConfig.update('exclude', newExclude, config.getConfigTarget());
        this.log(`Hiding ${Object.keys(newManagedExclusions).length} file(s)`);
      } catch (error) {
        this.log(`Error updating files.exclude: ${error}`);
      }
    }

    await config.setManagedExclusions(newManagedExclusions);
  }

  /**
   * Remove all managed exclusions (used when extension is disabled or deactivated).
   */
  async clearExclusions(): Promise<void> {
    const filesConfig = vscode.workspace.getConfiguration('files');
    const currentExclude = filesConfig.get<Record<string, boolean>>('exclude') || {};
    const managedExclusions = config.getManagedExclusions();

    // Remove all our managed patterns
    const newExclude: Record<string, boolean> = { ...currentExclude };
    for (const pattern of Object.keys(managedExclusions)) {
      delete newExclude[pattern];
    }

    if (!this.areEqual(currentExclude, newExclude)) {
      try {
        await filesConfig.update('exclude', newExclude, config.getConfigTarget());
        this.log('Cleared all managed exclusions');
      } catch (error) {
        this.log(`Error clearing exclusions: ${error}`);
      }
    }

    // Clear managed exclusions record
    await config.setManagedExclusions({});
  }

  private areEqual(a: Record<string, boolean>, b: Record<string, boolean>): boolean {
    const keysA = Object.keys(a).sort();
    const keysB = Object.keys(b).sort();

    if (keysA.length !== keysB.length) {
      return false;
    }

    for (let i = 0; i < keysA.length; i++) {
      if (keysA[i] !== keysB[i] || a[keysA[i]] !== b[keysB[i]]) {
        return false;
      }
    }

    return true;
  }

  private log(message: string): void {
    this.outputChannel.appendLine(`[YesterdaysLog] ${message}`);
  }
}
