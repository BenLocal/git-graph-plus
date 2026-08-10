<script lang="ts">
  import type { Commit } from '../../lib/types';
  import { t } from '../../lib/i18n/index.svelte';

  interface Props {
    commits: Commit[];
    selectedHash?: string | null;
    loading?: boolean;
    complete?: boolean;
    onSelect: (commit: Commit) => void;
    onLoadMore: () => void;
  }

  let {
    commits,
    selectedHash = null,
    loading = false,
    complete = true,
    onSelect,
    onLoadMore,
  }: Props = $props();

  function formatDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
  }

  function keepSelectedVisible(node: HTMLElement, selected: boolean) {
    const reveal = (active: boolean) => {
      if (active) node.scrollIntoView?.({ block: 'nearest' });
    };
    reveal(selected);
    return { update: reveal };
  }
</script>

<div class="search-results" role="table" aria-label={t('graph.searchResults', { count: commits.length, plural: commits.length === 1 ? '' : 's' })}>
  <div class="search-results-header" role="row">
    <div role="columnheader">{t('graph.description')}</div>
    <div role="columnheader">{t('graph.author')}</div>
    <div role="columnheader">{t('graph.sha')}</div>
    <div role="columnheader">{t('graph.date')}</div>
  </div>

  <div class="search-results-body" role="rowgroup">
    {#each commits as commit (commit.hash)}
      <button
        type="button"
        class="search-result-row"
        class:selected={selectedHash === commit.hash}
        role="row"
        use:keepSelectedVisible={selectedHash === commit.hash}
        onclick={() => onSelect(commit)}
      >
        <span class="subject" role="cell">{commit.subject}</span>
        <span class="author" role="cell">{commit.author.name}</span>
        <span class="hash" role="cell">{commit.abbreviatedHash}</span>
        <span class="date" role="cell">{formatDate(commit.author.date)}</span>
      </button>
    {/each}

    {#if commits.length === 0 && !loading}
      <div class="empty">{t('graph.noResults')}</div>
    {/if}

    {#if loading}
      <div class="loading"><i class="codicon codicon-loading codicon-modifier-spin"></i> {t('graph.loading')}</div>
    {:else if !complete}
      <button type="button" class="load-more" onclick={onLoadMore}>{t('graph.loadMore')}</button>
    {/if}
  </div>
</div>

<style>
  .search-results {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    background: var(--bg-primary);
    color: var(--text-primary);
  }

  .search-results-header,
  .search-result-row {
    display: grid;
    grid-template-columns: minmax(220px, 1fr) 160px 90px 180px;
    align-items: center;
    min-height: 30px;
    column-gap: 12px;
    padding: 0 12px;
  }

  .search-results-header {
    flex: none;
    border-bottom: 1px solid var(--border-color);
    color: var(--text-secondary);
    font-size: 12px;
  }

  .search-results-body {
    min-height: 0;
    overflow: auto;
  }

  .search-result-row {
    width: 100%;
    border: 0;
    border-bottom: 1px solid color-mix(in srgb, var(--border-color) 45%, transparent);
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .search-result-row:hover,
  .search-result-row.selected {
    background: var(--list-hover-background, var(--vscode-list-hoverBackground));
  }

  .search-result-row.selected {
    outline: 1px solid var(--vscode-focusBorder);
    outline-offset: -1px;
  }

  .subject,
  .author,
  .hash,
  .date {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .hash {
    font-family: var(--vscode-editor-font-family, monospace);
  }

  .empty,
  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 80px;
    color: var(--text-secondary);
  }

  .load-more {
    display: block;
    margin: 12px auto;
    padding: 5px 14px;
    border: 1px solid var(--border-color);
    border-radius: 3px;
    background: var(--button-secondary-bg, var(--vscode-button-secondaryBackground));
    color: var(--button-secondary-fg, var(--vscode-button-secondaryForeground));
    cursor: pointer;
  }
</style>
