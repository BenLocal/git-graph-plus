import { describe, it, expect } from 'vitest';
import { normalizeInteractiveRebaseMode, buildClassicRebaseCommand } from '../classic-rebase';

describe('normalizeInteractiveRebaseMode', () => {
  it('returns "classic" only for the exact string', () => {
    expect(normalizeInteractiveRebaseMode('classic')).toBe('classic');
  });
  it('falls back to "ui" for anything else', () => {
    expect(normalizeInteractiveRebaseMode('ui')).toBe('ui');
    expect(normalizeInteractiveRebaseMode('CLASSIC')).toBe('ui');
    expect(normalizeInteractiveRebaseMode(undefined)).toBe('ui');
    expect(normalizeInteractiveRebaseMode(42)).toBe('ui');
  });
});

describe('buildClassicRebaseCommand', () => {
  it('builds a bare-git rebase -i command for a valid hash', () => {
    expect(buildClassicRebaseCommand('a1b2c3d')).toBe('git rebase -i a1b2c3d');
  });
  it('accepts a full 40-char hash', () => {
    const full = '0123456789abcdef0123456789abcdef01234567';
    expect(buildClassicRebaseCommand(full)).toBe(`git rebase -i ${full}`);
  });
  it('returns null for non-hash input (injection guard)', () => {
    expect(buildClassicRebaseCommand('a1b2c3d; rm -rf /')).toBeNull();
    expect(buildClassicRebaseCommand('main')).toBeNull();
    expect(buildClassicRebaseCommand('')).toBeNull();
  });
});
