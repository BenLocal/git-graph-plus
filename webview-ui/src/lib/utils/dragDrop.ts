export type DropResolution =
  | { kind: 'ignore' }
  | { kind: 'blocked'; reason: 'uncommitted' }
  | { kind: 'menu'; source: string; target: string };

/**
 * Decide what a branch-label drop should do. Pure: no DOM, no stores.
 * Both ends must be local branches; same-branch is a no-op; uncommitted
 * changes block the operation (no auto-stash).
 */
export function resolveDrop(
  source: string,
  target: string,
  localBranchNames: ReadonlySet<string>,
  hasUncommitted: boolean,
): DropResolution {
  if (!source || !target) return { kind: 'ignore' };
  if (!localBranchNames.has(source) || !localBranchNames.has(target)) return { kind: 'ignore' };
  if (source === target) return { kind: 'ignore' };
  if (hasUncommitted) return { kind: 'blocked', reason: 'uncommitted' };
  return { kind: 'menu', source, target };
}

export function dragRebaseMessage(source: string, target: string) {
  return { type: 'dragRebase' as const, payload: { source, target } };
}

export function dragMergeMessage(source: string, target: string) {
  return { type: 'dragMerge' as const, payload: { source, target } };
}
