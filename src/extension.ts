import * as vscode from 'vscode';
import * as config from './config';
import { scanWorkspace, getFilesToHide } from './scanner';
import { ExcludeManager } from './excludeManager';
import { FileWatcher } from './watcher';

let excludeManager: ExcludeManager;
let fileWatcher: FileWatcher;
let outputChannel: vscode.OutputChannel;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  outputChannel = vscode.window.createOutputChannel('Yesterday\'s Log');
  log('Extension activating...');

  // Initialize config with extension context for workspace state storage
  config.initialize(context);

  excludeManager = new ExcludeManager(outputChannel);
  fileWatcher = new FileWatcher(refresh, outputChannel);

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('yesterdaysLog.toggle', toggleExtension),
    vscode.commands.registerCommand('yesterdaysLog.addFolder', addFolderRule),
    vscode.commands.registerCommand('yesterdaysLog.openGlobalSettings', openGlobalSettings),
    vscode.commands.registerCommand('yesterdaysLog.openProjectSettings', openProjectSettings)
  );

  // Listen for configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('yesterdaysLog')) {
        log('Configuration changed, refreshing...');
        handleConfigChange();
      }
    })
  );

  // Initial setup
  if (config.isEnabled()) {
    fileWatcher.start();
    await refresh();
  }

  log('Extension activated');
}

export async function deactivate(): Promise<void> {
  log('Extension deactivating...');

  fileWatcher.stop();
  await excludeManager.clearExclusions();

  log('Extension deactivated');
}

/**
 * Refresh: scan workspace and update exclusions.
 */
async function refresh(): Promise<void> {
  if (!config.isEnabled()) {
    return;
  }

  const rules = config.getRules();
  if (rules.length === 0) {
    log('No rules configured');
    await excludeManager.updateExclusions([]);
    return;
  }

  log(`Scanning workspace with ${rules.length} rule(s)...`);

  try {
    const scanResults = await scanWorkspace(rules);
    const filesToHide = getFilesToHide(scanResults);

    log(`Found ${filesToHide.length} file(s) to hide`);

    await excludeManager.updateExclusions(filesToHide);
  } catch (error) {
    log(`Error during refresh: ${error}`);
  }
}

/**
 * Toggle extension on/off.
 */
async function toggleExtension(): Promise<void> {
  const currentlyEnabled = config.isEnabled();
  const newState = !currentlyEnabled;

  await config.setEnabled(newState);

  if (newState) {
    vscode.window.showInformationMessage('Yesterday\'s Log: On (hiding old files)');
    fileWatcher.start();
    await refresh();
  } else {
    vscode.window.showInformationMessage('Yesterday\'s Log: Off (showing all files)');
    fileWatcher.stop();
    await excludeManager.clearExclusions();
  }
}

/**
 * Handle configuration changes.
 */
async function handleConfigChange(): Promise<void> {
  if (config.isEnabled()) {
    fileWatcher.start();
    await refresh();
  } else {
    fileWatcher.stop();
    await excludeManager.clearExclusions();
  }
}

/**
 * Add a folder rule via quick pick.
 */
async function addFolderRule(uri?: vscode.Uri): Promise<void> {
  let folderPath: string | undefined;

  if (uri) {
    // Called from context menu with a folder URI
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (workspaceFolder) {
      const relativePath = uri.fsPath.replace(workspaceFolder.uri.fsPath, '').replace(/^[/\\]/, '');
      folderPath = `**/${relativePath.split(/[/\\]/).pop()}`;
    }
  }

  // Ask for pattern
  const pattern = await vscode.window.showInputBox({
    prompt: 'Enter folder pattern (glob)',
    value: folderPath || '**/logs',
    placeHolder: '**/logs, **/build/reports, etc.'
  });

  if (!pattern) {
    return;
  }

  // Ask for show value (count or duration)
  const showStr = await vscode.window.showInputBox({
    prompt: 'Files to show: number (e.g., 3) or duration (e.g., 7d, 2w, 3M)',
    value: '3',
    validateInput: (value) => {
      // Check if it's a valid number
      const num = parseInt(value, 10);
      if (!isNaN(num) && num >= 1 && num <= 100 && String(num) === value) {
        return null;
      }
      // Check if it's a valid duration
      if (/^\d+[mhdwMy]$/.test(value)) {
        return null;
      }
      return 'Enter a number (1-100) or duration (e.g., 7d, 2w, 3M)';
    }
  });

  if (!showStr) {
    return;
  }

  // Parse as number if possible, otherwise keep as string
  const show: number | string = /^\d+$/.test(showStr) ? parseInt(showStr, 10) : showStr;

  // Add the rule
  await config.addRule({ pattern, show });
  vscode.window.showInformationMessage(`Added rule: Show ${showStr} in ${pattern}`);

  // Refresh to apply new rule
  await refresh();
}

/**
 * Open global (user) settings filtered to this extension.
 */
async function openGlobalSettings(): Promise<void> {
  await vscode.commands.executeCommand(
    'workbench.action.openSettings',
    '@ext:trych.yesterdays-log'
  );
}

/**
 * Open project (workspace) settings filtered to this extension.
 */
async function openProjectSettings(): Promise<void> {
  if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
    vscode.window.showWarningMessage('No workspace folder open. Open a folder first to use project settings.');
    return;
  }

  await vscode.commands.executeCommand(
    'workbench.action.openWorkspaceSettings',
    '@ext:trych.yesterdays-log'
  );
}

function log(message: string): void {
  outputChannel.appendLine(`[YesterdaysLog] ${message}`);
}
