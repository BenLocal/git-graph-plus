import { describe, it, expect } from 'vitest';
import { resolveDrop, dragRebaseMessage, dragMergeMessage } from '../dragDrop';

const locals = new Set(['main', 'feature', 'develop']);

describe('resolveDrop', () => {
  it('ignores an empty source or target', () => {
    expect(resolveDrop('', 'main', locals, false)).toEqual({ kind: 'ignore' });
    expect(resolveDrop('feature', '', locals, false)).toEqual({ kind: 'ignore' });
  });

  it('ignores when source or target is not a local branch', () => {
    expect(resolveDrop('feature', 'origin/main', locals, false)).toEqual({ kind: 'ignore' });
    expect(resolveDrop('v1.0', 'main', locals, false)).toEqual({ kind: 'ignore' });
  });

  it('ignores dropping a branch onto itself', () => {
    expect(resolveDrop('feature', 'feature', locals, false)).toEqual({ kind: 'ignore' });
  });

  it('blocks when the working tree has uncommitted changes', () => {
    expect(resolveDrop('feature', 'main', locals, true)).toEqual({ kind: 'blocked', reason: 'uncommitted' });
  });

  it('returns a menu resolution for a valid local->local drop', () => {
    expect(resolveDrop('feature', 'main', locals, false)).toEqual({ kind: 'menu', source: 'feature', target: 'main' });
  });
});

describe('drag message builders', () => {
  it('builds a dragRebase message', () => {
    expect(dragRebaseMessage('feature', 'main')).toEqual({ type: 'dragRebase', payload: { source: 'feature', target: 'main' } });
  });

  it('builds a dragMerge message', () => {
    expect(dragMergeMessage('feature', 'main')).toEqual({ type: 'dragMerge', payload: { source: 'feature', target: 'main' } });
  });
});
