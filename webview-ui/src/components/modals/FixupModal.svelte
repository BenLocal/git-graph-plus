<script lang="ts">
  import { onMount } from 'svelte';
  import Modal from '../common/Modal.svelte';
  import { t } from '../../lib/i18n/index.svelte';
  import { tooltip } from '../../lib/actions/tooltip';
  import { getVsCodeApi } from '../../lib/vscode-api';

  interface Props {
    commit: string;
    onClose: () => void;
    onFixup: () => void;
  }

  let { commit, onClose, onFixup }: Props = $props();

  const shortHash = (h: string) => /^[0-9a-f]{40}$/i.test(h) ? h.substring(0, 7) : h;

  // Live count of staged files (what the fixup commit captures). Refreshes
  // whenever the index changes — e.g. the user stages/unstages in the SCM view
  // we opened alongside this modal.
  let stagedCount = $state<number | null>(null);
  onMount(() => {
    const vscode = getVsCodeApi();
    const request = () => vscode.postMessage({ type: 'getUncommittedDiff' });
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg?.type === 'uncommittedDiffData') {
        stagedCount = (msg.payload?.staged ?? []).length;
      } else if (msg?.type === 'repoChanged') {
        request();
      }
    };
    window.addEventListener('message', handler);
    request();
    return () => window.removeEventListener('message', handler);
  });

  const canFixup = $derived((stagedCount ?? 0) > 0);
</script>

<Modal title={t('fixup.title')} {onClose}>
  <p class="modal-desc">{t('fixup.desc')}</p>
  <div class="modal-context-card">
    <span use:tooltip={commit} class="modal-pill modal-pill--target">
      <i class="codicon codicon-git-commit"></i>
      <span class="modal-pill-text">{shortHash(commit)}</span>
    </span>
  </div>

  <div class="form-actions">
    <div
      class="staged-status"
      class:is-warning={stagedCount === 0}
      class:is-success={(stagedCount ?? 0) > 0}
    >
      {#if stagedCount === null}
        <span class="spinner"></span>
        <span>{t('fixup.checkingStaged')}</span>
      {:else if stagedCount === 0}
        <i class="codicon codicon-warning"></i>
        <span>{t('fixup.stagedNone')}</span>
      {:else}
        <i class="codicon codicon-check modal-status-check"></i>
        <span>{t('fixup.stagedIncluded', { count: String(stagedCount) })}</span>
      {/if}
    </div>
    <button onclick={onClose}>{t('common.cancel')}</button>
    <button class="primary" onclick={onFixup} disabled={!canFixup}>{t('fixup.fixup')}</button>
  </div>
</Modal>

<style>
  .staged-status {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: inherit;
    color: var(--text-secondary);
    margin-right: auto;
  }
  .staged-status.is-warning { color: #f0a020; }
  .staged-status.is-success { color: #4caf50; }
</style>
