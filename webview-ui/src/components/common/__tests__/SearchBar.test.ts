import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import SearchBar from '../SearchBar.svelte';
import { i18n } from '../../../lib/i18n/index.svelte';
import type { BranchInfo } from '../../../lib/types';

const baseProps = {
  onSearch: vi.fn(),
  onClear: vi.fn(),
  onPrevious: vi.fn(),
  onNext: vi.fn(),
};

beforeEach(() => {
  i18n.setLocale('en');
  vi.useFakeTimers();
});

describe('SearchBar — basic search', () => {
  it('typing then waiting 150ms requests a full-history search', async () => {
    const onSearch = vi.fn();
    const { container } = render(SearchBar, { ...baseProps, onSearch });
    const input = container.querySelector<HTMLInputElement>('.search-input')!;
    await fireEvent.input(input, { target: { value: '  login  ' } });
    vi.advanceTimersByTime(150);
    expect(onSearch).toHaveBeenCalledWith('login');
  });

  it('Enter submits once and cancels the pending debounce', async () => {
    const onSearch = vi.fn();
    const { container } = render(SearchBar, { ...baseProps, onSearch });
    const input = container.querySelector<HTMLInputElement>('.search-input')!;
    await fireEvent.input(input, { target: { value: 'login' } });
    await fireEvent.keyDown(container.querySelector('.search-bar')!, { key: 'Enter' });
    expect(onSearch).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(150);
    expect(onSearch).toHaveBeenCalledOnce();
  });

  it('clearing the input cancels the active search', async () => {
    const onClear = vi.fn();
    const { container } = render(SearchBar, { ...baseProps, onClear });
    const input = container.querySelector<HTMLInputElement>('.search-input')!;
    await fireEvent.input(input, { target: { value: 'fix' } });
    vi.advanceTimersByTime(150);
    onClear.mockClear();
    await fireEvent.input(input, { target: { value: '' } });
    expect(onClear).toHaveBeenCalledOnce();
  });

  it('shows an inexact total while the backend has more history to scan', async () => {
    const { container } = render(SearchBar, {
      ...baseProps,
      resultCount: 50,
      currentIndex: 0,
      searchComplete: false,
    });
    const input = container.querySelector<HTMLInputElement>('.search-input')!;
    await fireEvent.input(input, { target: { value: 'match' } });
    expect(container.querySelector('.count-total')?.textContent).toBe('50+');
  });
});

describe('SearchBar — keyboard navigation', () => {
  it('Enter requests the next result when results exist', async () => {
    const onNext = vi.fn();
    const { container } = render(SearchBar, { ...baseProps, onNext, resultCount: 2, currentIndex: 0 });
    const input = container.querySelector<HTMLInputElement>('.search-input')!;
    await fireEvent.input(input, { target: { value: 'match' } });
    await fireEvent.keyDown(container.querySelector('.search-bar')!, { key: 'Enter' });
    expect(onNext).toHaveBeenCalledOnce();
  });

  it('Shift+Enter requests the previous result', async () => {
    const onPrevious = vi.fn();
    const { container } = render(SearchBar, { ...baseProps, onPrevious, resultCount: 2, currentIndex: 0 });
    const input = container.querySelector<HTMLInputElement>('.search-input')!;
    await fireEvent.input(input, { target: { value: 'match' } });
    await fireEvent.keyDown(container.querySelector('.search-bar')!, { key: 'Enter', shiftKey: true });
    expect(onPrevious).toHaveBeenCalledOnce();
  });

  it('Escape with no open dropdown clears the query', async () => {
    const { container } = render(SearchBar, baseProps);
    const input = container.querySelector<HTMLInputElement>('.search-input')!;
    await fireEvent.input(input, { target: { value: 'x' } });
    vi.advanceTimersByTime(150);
    await fireEvent.keyDown(container.querySelector('.search-bar')!, { key: 'Escape' });
    expect(input.value).toBe('');
  });

  it('prev/next buttons are disabled when no matches', async () => {
    const { container } = render(SearchBar, baseProps);
    const input = container.querySelector<HTMLInputElement>('.search-input')!;
    await fireEvent.input(input, { target: { value: 'zzz' } });
    vi.advanceTimersByTime(150);
    const navBtns = container.querySelectorAll<HTMLButtonElement>('.nav-btn');
    // up, down, close (3)
    expect(navBtns[0].disabled).toBe(true);
    expect(navBtns[1].disabled).toBe(true);
  });

  it('clicking the X button clears the search', async () => {
    const onClear = vi.fn();
    const { container } = render(SearchBar, { ...baseProps, onClear });
    const input = container.querySelector<HTMLInputElement>('.search-input')!;
    await fireEvent.input(input, { target: { value: 'foo' } });
    vi.advanceTimersByTime(150);
    onClear.mockClear();
    await fireEvent.click(container.querySelector<HTMLButtonElement>('.close-btn')!);
    expect(onClear).toHaveBeenCalledOnce();
    expect(input.value).toBe('');
  });
});

describe('SearchBar — filter UI', () => {
  it('source filter button toggles dropdown open/closed', async () => {
    const { container } = render(SearchBar, { ...baseProps, remotes: ['origin'] });
    expect(container.querySelector('.dropdown')).toBeNull();
    await fireEvent.click(container.querySelectorAll<HTMLButtonElement>('.filter-btn')[0]);
    expect(container.querySelector('.dropdown')).not.toBeNull();
    await fireEvent.click(container.querySelectorAll<HTMLButtonElement>('.filter-btn')[0]);
    expect(container.querySelector('.dropdown')).toBeNull();
  });

  it('clicking a remote in the source filter calls onFilterChange', async () => {
    const onFilterChange = vi.fn();
    const { container } = render(SearchBar, { ...baseProps, remotes: ['origin', 'upstream'], onFilterChange });
    await fireEvent.click(container.querySelectorAll<HTMLButtonElement>('.filter-btn')[0]);
    const items = container.querySelectorAll<HTMLButtonElement>('.dd-item');
    // items: [All, Local, origin, upstream]
    await fireEvent.click(items[2]);
    expect(onFilterChange).toHaveBeenCalledWith(['origin']);
  });

  it('"All" item clears the source filter', async () => {
    const onFilterChange = vi.fn();
    const { container } = render(SearchBar, {
      ...baseProps,
      remotes: ['origin'],
      remoteFilter: ['origin'],
      onFilterChange,
    });
    await fireEvent.click(container.querySelectorAll<HTMLButtonElement>('.filter-btn')[0]);
    const items = container.querySelectorAll<HTMLButtonElement>('.dd-item');
    await fireEvent.click(items[0]);
    expect(onFilterChange).toHaveBeenCalledWith([]);
  });

  it('Enter with empty query clears (no search posted)', async () => {
    const onClear = vi.fn();
    const { container } = render(SearchBar, { ...baseProps, onClear });
    onClear.mockClear();
    // Press Enter without typing anything — Enter with no matches and no query
    // falls through to doSearch(), which sees empty query and calls clear().
    await fireEvent.keyDown(container.querySelector('.search-bar')!, { key: 'Enter' });
    expect(onClear).toHaveBeenCalledOnce();
  });

  it('Escape closes the open branch-filter dropdown without clearing the query', async () => {
    const branches = [{ name: 'main', current: true, ahead: 0, behind: 0, hash: 'h' }];
    const { container } = render(SearchBar, { ...baseProps, branches });
    const input = container.querySelector<HTMLInputElement>('.search-input')!;
    await fireEvent.input(input, { target: { value: 'foo' } });
    vi.advanceTimersByTime(150);
    await fireEvent.click(container.querySelectorAll<HTMLButtonElement>('.filter-btn')[1]);
    expect(container.querySelector('.dropdown')).not.toBeNull();
    await fireEvent.keyDown(container.querySelector('.search-bar')!, { key: 'Escape' });
    expect(container.querySelector('.dropdown')).toBeNull();
    expect(input.value).toBe('foo');
  });

  it('source filter backdrop click closes the dropdown', async () => {
    const { container } = render(SearchBar, { ...baseProps, remotes: ['origin'] });
    await fireEvent.click(container.querySelectorAll<HTMLButtonElement>('.filter-btn')[0]);
    expect(container.querySelector('.dropdown')).not.toBeNull();
    await fireEvent.click(container.querySelector<HTMLDivElement>('.backdrop')!);
    expect(container.querySelector('.dropdown')).toBeNull();
  });

  it('branch filter backdrop click closes the dropdown', async () => {
    const { container } = render(SearchBar, {
      ...baseProps,
      branches: [{ name: 'main', current: true, ahead: 0, behind: 0, hash: 'h' }],
    });
    await fireEvent.click(container.querySelectorAll<HTMLButtonElement>('.filter-btn')[1]);
    expect(container.querySelector('.dropdown')).not.toBeNull();
    await fireEvent.click(container.querySelector<HTMLDivElement>('.backdrop')!);
    expect(container.querySelector('.dropdown')).toBeNull();
  });

  it('Escape closes the open source-filter dropdown without clearing the query', async () => {
    const { container } = render(SearchBar, { ...baseProps, remotes: ['origin'] });
    const input = container.querySelector<HTMLInputElement>('.search-input')!;
    await fireEvent.input(input, { target: { value: 'foo' } });
    vi.advanceTimersByTime(150);
    await fireEvent.click(container.querySelectorAll<HTMLButtonElement>('.filter-btn')[0]);
    expect(container.querySelector('.dropdown')).not.toBeNull();
    await fireEvent.keyDown(container.querySelector('.search-bar')!, { key: 'Escape' });
    expect(container.querySelector('.dropdown')).toBeNull();
    expect(input.value).toBe('foo');
  });
});

describe('SearchBar — branch filter', () => {
  const branches: BranchInfo[] = [
    { name: 'main', current: true, ahead: 0, behind: 0, hash: 'h' },
    { name: 'feature/login', current: false, ahead: 0, behind: 0, hash: 'h' },
    { name: 'origin/main', current: false, remote: 'origin', ahead: 0, behind: 0, hash: 'h' },
    { name: 'origin/HEAD', current: false, remote: 'origin', ahead: 0, behind: 0, hash: 'h' },
  ];

  it('lists local and remote branches grouped, skipping origin/HEAD', async () => {
    const { container } = render(SearchBar, { ...baseProps, branches, remotes: ['origin'] });
    await fireEvent.click(container.querySelectorAll<HTMLButtonElement>('.filter-btn')[1]);
    const items = Array.from(container.querySelectorAll('.dd-item')).map(el => el.textContent?.trim());
    expect(items.some(t => t?.includes('main'))).toBe(true);
    expect(items.some(t => t?.includes('feature/login'))).toBe(true);
    expect(items.some(t => t === 'origin/HEAD')).toBe(false);
  });

  it('clicking a branch fires onBranchFilterChange', async () => {
    const onBranchFilterChange = vi.fn();
    const { container } = render(SearchBar, { ...baseProps, branches, onBranchFilterChange });
    await fireEvent.click(container.querySelectorAll<HTMLButtonElement>('.filter-btn')[1]);
    const items = container.querySelectorAll<HTMLButtonElement>('.dd-item');
    const featureItem = Array.from(items).find(i => i.textContent?.includes('feature/login'))!;
    await fireEvent.click(featureItem);
    expect(onBranchFilterChange).toHaveBeenCalledWith(['feature/login']);
  });

  it('typing in the branch search input narrows the list', async () => {
    const { container } = render(SearchBar, { ...baseProps, branches });
    await fireEvent.click(container.querySelectorAll<HTMLButtonElement>('.filter-btn')[1]);
    const search = container.querySelector<HTMLInputElement>('.branch-search-input')!;
    await fireEvent.input(search, { target: { value: 'feat' } });
    const items = Array.from(container.querySelectorAll('.dd-item')).map(el => el.textContent?.trim());
    expect(items.some(t => t?.includes('feature/login'))).toBe(true);
    expect(items.some(t => t === 'main')).toBe(false);
  });

  it('"All branches" item clears the branch filter', async () => {
    const onBranchFilterChange = vi.fn();
    const { container } = render(SearchBar, {
      ...baseProps,
      branches,
      branchFilter: ['main'],
      onBranchFilterChange,
    });
    await fireEvent.click(container.querySelectorAll<HTMLButtonElement>('.filter-btn')[1]);
    const items = container.querySelectorAll<HTMLButtonElement>('.dd-item');
    await fireEvent.click(items[0]);
    expect(onBranchFilterChange).toHaveBeenCalledWith([]);
  });
});

describe('SearchBar — jump to HEAD button', () => {
  it('is disabled when no commit is HEAD', () => {
    const { container } = render(SearchBar, { ...baseProps });
    const btn = container.querySelector<HTMLButtonElement>('.head-btn')!;
    expect(btn).toBeTruthy();
    expect(btn.disabled).toBe(true);
  });

  it('is enabled and calls onJumpToHead when clicked', async () => {
    const onJumpToHead = vi.fn();
    const { container } = render(SearchBar, { ...baseProps, hasHead: true, onJumpToHead });
    const btn = container.querySelector<HTMLButtonElement>('.head-btn')!;
    expect(btn.disabled).toBe(false);
    await fireEvent.click(btn);
    expect(onJumpToHead).toHaveBeenCalled();
  });

  it('has the active class when headOffscreen is true', () => {
    const { container } = render(SearchBar, { ...baseProps, hasHead: true, headOffscreen: true });
    const btn = container.querySelector<HTMLButtonElement>('.head-btn')!;
    expect(btn.classList.contains('active')).toBe(true);
  });
});
