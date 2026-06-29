/** Which interactive-rebase experience the user gets. */
export type InteractiveRebaseMode = 'ui' | 'classic';

/** Map a raw setting value to a valid mode, defaulting to the GUI. */
export function normalizeInteractiveRebaseMode(raw: unknown): InteractiveRebaseMode {
  return raw === 'classic' ? 'classic' : 'ui';
}

/**
 * Build the shell command for a classic `git rebase -i <base>` run in a
 * terminal. Returns null when `base` is not a commit hash - the value is
 * spliced into a shell command, so anything else is rejected as an injection
 * guard. `base` always comes from our own commit data in the normal path.
 *
 * Uses bare `git` (resolved on the terminal's PATH) rather than an absolute
 * binary path: a quoted, spaced path is parsed as a string literal in
 * PowerShell (VS Code's default Windows shell) and silently never runs. Bare
 * `git` works across PowerShell/bash/cmd, and a missing git surfaces a visible
 * "command not found" instead of a silent no-op.
 */
export function buildClassicRebaseCommand(base: string): string | null {
  if (!/^[0-9a-fA-F]{4,40}$/.test(base)) { return null; }
  return `git rebase -i ${base}`;
}
