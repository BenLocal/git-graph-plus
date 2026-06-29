import type { InteractiveRebaseMode } from './types';

/**
 * Route an interactive-rebase request to the GUI modal or the classic terminal
 * flow based on the user's mode. Keeps the branch logic out of the component so
 * it is unit-testable.
 */
export function dispatchInteractiveRebase(
  base: string,
  mode: InteractiveRebaseMode,
  handlers: { openModal: (base: string) => void; runClassic: (base: string) => void },
): void {
  if (mode === 'classic') { handlers.runClassic(base); }
  else { handlers.openModal(base); }
}
