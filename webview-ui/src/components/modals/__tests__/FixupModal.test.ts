import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/svelte';
import { tick } from 'svelte';
import FixupModal from '../FixupModal.svelte';
import { i18n } from '../../../lib/i18n/index.svelte';

beforeEach(() => { i18n.setLocale('en'); globalThis.__postedMessages.length = 0; });
afterEach(() => cleanup());

const base = { commit: 'abcdef1234567890' };

function emitStaged(count: number) {
  window.dispatchEvent(new MessageEvent('message', {
    data: { type: 'uncommittedDiffData', payload: { staged: Array.from({ length: count }, (_, i) => ({ path: `f${i}.ts`, status: 'M' })), unstaged: [] } },
  }));
}

describe('FixupModal', () => {
  it('requests the uncommitted diff on mount', () => {
    render(FixupModal, { ...base, onClose: vi.fn(), onFixup: vi.fn() });
    const posted = globalThis.__postedMessages.map(m => m.data) as Array<{ type: string }>;
    expect(posted.some(p => p.type === 'getUncommittedDiff')).toBe(true);
  });

  it('shows the checking spinner and disables the button before a response arrives', () => {
    const { container } = render(FixupModal, { ...base, onClose: vi.fn(), onFixup: vi.fn() });
    expect(container.querySelector('.spinner')).not.toBeNull();
    expect(container.querySelector<HTMLButtonElement>('button.primary')!.disabled).toBe(true);
  });

  it('warns and keeps the button disabled when nothing is staged', async () => {
    const { container } = render(FixupModal, { ...base, onClose: vi.fn(), onFixup: vi.fn() });
    emitStaged(0);
    await tick();
    expect(container.querySelector('.spinner')).toBeNull();
    expect(container.querySelector('.staged-status.is-warning')).not.toBeNull();
    expect(container.querySelector<HTMLButtonElement>('button.primary')!.disabled).toBe(true);
  });

  it('enables the button and calls onFixup when there are staged changes', async () => {
    const onFixup = vi.fn();
    const { container } = render(FixupModal, { ...base, onClose: vi.fn(), onFixup });
    emitStaged(2);
    await tick();
    expect(container.querySelector('.staged-status.is-success')).not.toBeNull();
    const btn = container.querySelector<HTMLButtonElement>('button.primary')!;
    expect(btn.disabled).toBe(false);
    await fireEvent.click(btn);
    expect(onFixup).toHaveBeenCalledTimes(1);
  });

  it('re-requests the diff when the repo changes', async () => {
    render(FixupModal, { ...base, onClose: vi.fn(), onFixup: vi.fn() });
    globalThis.__postedMessages.length = 0;
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'repoChanged' } }));
    await tick();
    const posted = globalThis.__postedMessages.map(m => m.data) as Array<{ type: string }>;
    expect(posted.some(p => p.type === 'getUncommittedDiff')).toBe(true);
  });
});
