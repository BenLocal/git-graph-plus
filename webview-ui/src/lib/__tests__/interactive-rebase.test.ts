import { describe, it, expect, vi } from 'vitest';
import { dispatchInteractiveRebase } from '../interactive-rebase';

describe('dispatchInteractiveRebase', () => {
  it('opens the modal in ui mode and does not run classic', () => {
    const openModal = vi.fn();
    const runClassic = vi.fn();
    dispatchInteractiveRebase('abc1234', 'ui', { openModal, runClassic });
    expect(openModal).toHaveBeenCalledWith('abc1234');
    expect(runClassic).not.toHaveBeenCalled();
  });

  it('runs classic in classic mode and does not open the modal', () => {
    const openModal = vi.fn();
    const runClassic = vi.fn();
    dispatchInteractiveRebase('abc1234', 'classic', { openModal, runClassic });
    expect(runClassic).toHaveBeenCalledWith('abc1234');
    expect(openModal).not.toHaveBeenCalled();
  });
});
