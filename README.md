# Yesterday's Log

> *"Nothing is older than yesterday's log."*

So let's hide it. This VS Code extension declutters your workspace by showing only the most recent files in folders you specify — perfect for logs, build outputs, and other generated files that pile up fast.

## Features

- **Count-based filtering**: Show only the N newest files
- **Age-based filtering**: Show files from the last N days/weeks/months
- **Exclude patterns**: Always hide specific files (e.g., lock files, temp files)
- **Auto-refresh**: Automatically updates when files are added or removed
- **Merges with existing rules**: Works alongside your existing `files.exclude` settings
- **Global + project rules**: Set rules globally or per-project

## Usage

### 1. Add a rule via Command Palette

1. Open Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
2. Run `Yesterday's Log: Add Folder Rule`
3. Enter a folder pattern (e.g., `**/logs`)
4. Enter how many files to show (number or duration like `7d`)

### 2. Add a rule via context menu

Right-click any folder in the Explorer and select `Yesterday's Log: Add Folder Rule`.

### 3. Configure manually in settings

Add rules directly to your settings (user or workspace):

```json
{
  "recentFilesOnly.rules": [
    { "pattern": "**/logs", "show": 3 },
    { "pattern": "**/output", "show": "7d", "exclude": "*.tmp" }
  ]
}
```

## Commands

| Command | Description |
|---------|-------------|
| `Yesterday's Log: Toggle On/Off` | Enable or disable file hiding (shows all files when off) |
| `Yesterday's Log: Add Folder Rule` | Add a new rule interactively |
| `Yesterday's Log: Open Global Settings` | Open user settings filtered to this extension |
| `Yesterday's Log: Open Project Settings` | Open workspace settings filtered to this extension |

## Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `recentFilesOnly.enabled` | boolean | `true` | Enable or disable the extension |
| `recentFilesOnly.rules` | array | `[]` | Rules for limiting files in folders |

### Rule format

Each rule has:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `pattern` | string | Yes | Glob pattern for matching folders, e.g., `**/logs`, `build/output` |
| `show` | number or string | Yes | Files to show: a number (e.g., `3`) or duration (e.g., `7d`, `2w`, `3M`) |
| `exclude` | string | No | Glob pattern for files to always hide and exclude from counting |

### Duration units

When using age-based filtering, these units are supported:

| Unit | Meaning |
|------|---------|
| `m` | minutes |
| `h` | hours |
| `d` | days |
| `w` | weeks |
| `M` | months |
| `y` | years |

Examples: `30m` (30 minutes), `12h` (12 hours), `7d` (7 days), `2w` (2 weeks), `3M` (3 months), `1y` (1 year)

## How it works

1. The extension scans your workspace for folders matching your configured patterns
2. For each matching folder, it lists all files and sorts them by modification time
3. Files matching the `exclude` pattern are always hidden (and not counted)
4. Remaining files are filtered by count or age based on the `show` value
5. Hidden files are added to VS Code's `files.exclude` setting
6. When files change, the extension automatically re-scans and updates

The extension carefully tracks which exclusion patterns it manages, so your own `files.exclude` settings are preserved.

## Examples

### Keep 3 most recent files

```json
{
  "recentFilesOnly.rules": [
    { "pattern": "**/logs", "show": 3 }
  ]
}
```

If your `logs` folder contains:
- `app-2026-01-01.log` (oldest)
- `app-2026-01-02.log`
- `app-2026-01-03.log`
- `app-2026-01-04.log`
- `app-2026-01-05.log` (newest)

Only the 3 newest files will be visible:
- `app-2026-01-03.log`
- `app-2026-01-04.log`
- `app-2026-01-05.log`

### Show files from last 7 days

```json
{
  "recentFilesOnly.rules": [
    { "pattern": "**/reports", "show": "7d" }
  ]
}
```

Files older than 7 days will be hidden.

### Exclude temporary files

```json
{
  "recentFilesOnly.rules": [
    { "pattern": "**/output", "show": 5, "exclude": "*.tmp" }
  ]
}
```

Temporary files (`*.tmp`) will always be hidden and won't count toward the 5 visible files.

## Tips

- Use `**/` prefix to match folders at any depth (e.g., `**/logs` matches `logs`, `src/logs`, `foo/bar/logs`)
- Rules from user settings and workspace settings are merged
- Use "Toggle On/Off" to temporarily show all hidden files without changing your rules
- Check the Output panel (`Yesterday's Log`) for debugging information

## License

MIT
