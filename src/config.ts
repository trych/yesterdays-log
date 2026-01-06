import * as vscode from 'vscode';
import { Rule } from './types';

const CONFIG_SECTION = 'yesterdaysLog';
const MANAGED_EXCLUSIONS_KEY = 'managedExclusions';

let extensionContext: vscode.ExtensionContext | undefined;

/**
 * Initialize the config module with the extension context.
 * Must be called during extension activation.
 */
export function initialize(context: vscode.ExtensionContext): void {
  extensionContext = context;
}

/**
 * Get the appropriate configuration target.
 * Uses Workspace if available, otherwise falls back to Global (user settings).
 */
export function getConfigTarget(): vscode.ConfigurationTarget {
  if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
    return vscode.ConfigurationTarget.Workspace;
  }
  return vscode.ConfigurationTarget.Global;
}

export function isEnabled(): boolean {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  return config.get<boolean>('enabled', true);
}

export function getRules(): Rule[] {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  return config.get<Rule[]>('rules', []);
}

/**
 * Get managed exclusions from workspace state (hidden from user).
 */
export function getManagedExclusions(): Record<string, boolean> {
  if (!extensionContext) {
    return {};
  }
  return extensionContext.workspaceState.get<Record<string, boolean>>(MANAGED_EXCLUSIONS_KEY, {});
}

/**
 * Save managed exclusions to workspace state (hidden from user).
 */
export async function setManagedExclusions(exclusions: Record<string, boolean>): Promise<void> {
  if (!extensionContext) {
    return;
  }
  await extensionContext.workspaceState.update(MANAGED_EXCLUSIONS_KEY, exclusions);
}

export async function setEnabled(
  enabled: boolean,
  target?: vscode.ConfigurationTarget
): Promise<void> {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  await config.update('enabled', enabled, target ?? getConfigTarget());
}

export async function addRule(
  rule: Rule,
  target?: vscode.ConfigurationTarget
): Promise<void> {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  const rules = getRules();

  // Check if rule with same pattern already exists
  const existingIndex = rules.findIndex(r => r.pattern === rule.pattern);
  if (existingIndex >= 0) {
    rules[existingIndex] = rule;
  } else {
    rules.push(rule);
  }

  await config.update('rules', rules, target ?? getConfigTarget());
}
