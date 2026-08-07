import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { GitService, GitError } from '../git-service';

// Mock child_process so we can drive the spawned process by hand: emit stdout
// to trigger the buffer-overflow guard, or withhold 'close' to trigger the
// timeout guard. These two paths in GitService.exec are the safety net that
// keeps a pathological git invocation from OOMing or hanging the extension
// host, so they're worth exercising even though they can't run real git.
import * as childProcess from 'child_process';
vi.mock('child_process', () => ({ spawn: vi.fn() }));

// Minimal stream stand-in. bufferStream only uses on('data'|'end'|'error') and
// destroy(), so a plain EventEmitter avoids the real Readable's internal
// setImmediate scheduling (which deadlocks against fake timers).
function fakeStream() {
  const s = new EventEmitter() as EventEmitter & {
    destroy: ReturnType<typeof vi.fn>;
    setEncoding: ReturnType<typeof vi.fn>;
    pause: ReturnType<typeof vi.fn>;
    resume: ReturnType<typeof vi.fn>;
  };
  s.destroy = vi.fn();
  s.setEncoding = vi.fn();
  s.pause = vi.fn();
  s.resume = vi.fn();
  return s;
}

function fakeProc() {
  const proc = new EventEmitter() as EventEmitter & {
    stdout: ReturnType<typeof fakeStream>;
    stderr: ReturnType<typeof fakeStream>;
    stdin: { write: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> };
    kill: ReturnType<typeof vi.fn>;
  };
  proc.stdout = fakeStream();
  proc.stderr = fakeStream();
  proc.stdin = { write: vi.fn(), end: vi.fn() };
  proc.kill = vi.fn();
  return proc;
}

const spawnMock = vi.mocked(childProcess.spawn);

describe('GitService.exec safety guards', () => {
  let service: GitService;
  let proc: ReturnType<typeof fakeProc>;

  beforeEach(() => {
    vi.useFakeTimers();
    service = new GitService('/tmp/test-repo');
    proc = fakeProc();
    spawnMock.mockReturnValue(proc as unknown as ReturnType<typeof childProcess.spawn>);
  });

  afterEach(() => {
    // Discards killHard()'s pending 5s SIGKILL timer so it can't leak.
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('rejects with a GitError when stdout exceeds maxBufferBytes', async () => {
    const p = (service as never as { exec: (a: string[], o?: object) => Promise<string> })
      .exec(['version'], { maxBufferBytes: 4, silent: true });
    // 11 bytes against a 4-byte cap → overflow.
    proc.stdout.emit('data', Buffer.from('hello world'));
    await expect(p).rejects.toThrow(/exceeded 4 bytes/);
    await expect(p).rejects.toBeInstanceOf(GitError);
    // The guard must terminate the runaway process.
    expect(proc.kill).toHaveBeenCalled();
  });

  it('rejects with a GitError when the command exceeds its timeout', async () => {
    const p = (service as never as { exec: (a: string[], o?: object) => Promise<string> })
      .exec(['version'], { timeout: 20, silent: true });
    // Attach the rejection handler before advancing time, so the timeout
    // reject never momentarily looks "unhandled" between fire and assert.
    const assertion = expect(p).rejects.toThrow(/timed out after 20ms/);
    // Never emit 'close'; let the timeout timer fire.
    await vi.advanceTimersByTimeAsync(20);
    await assertion;
    expect(proc.kill).toHaveBeenCalledWith('SIGTERM');
  });

  it('uses a 60s default timeout when none is given', async () => {
    const p = (service as never as { exec: (a: string[], o?: object) => Promise<string> })
      .exec(['version'], { silent: true });
    const assertion = expect(p).rejects.toThrow(/timed out after 60000ms/);
    // Never emit 'close'; let the default timeout timer fire.
    await vi.advanceTimersByTimeAsync(60000);
    await assertion;
    expect(proc.kill).toHaveBeenCalledWith('SIGTERM');
  });

  it('honors a default timeout overridden via setDefaultTimeout', async () => {
    service.setDefaultTimeout(120000);
    const p = (service as never as { exec: (a: string[], o?: object) => Promise<string> })
      .exec(['version'], { silent: true });
    const assertion = expect(p).rejects.toThrow(/timed out after 120000ms/);
    await vi.advanceTimersByTimeAsync(120000);
    await assertion;
    expect(proc.kill).toHaveBeenCalledWith('SIGTERM');
  });

  it('ignores a non-positive default timeout and keeps the 60s fallback', async () => {
    service.setDefaultTimeout(0);
    const p = (service as never as { exec: (a: string[], o?: object) => Promise<string> })
      .exec(['version'], { silent: true });
    const assertion = expect(p).rejects.toThrow(/timed out after 60000ms/);
    await vi.advanceTimersByTimeAsync(60000);
    await assertion;
  });

  it('resolves with stdout on a clean exit (control case)', async () => {
    const p = (service as never as { exec: (a: string[], o?: object) => Promise<string> })
      .exec(['version'], { silent: true });
    proc.stdout.emit('data', Buffer.from('git version 2.40.0'));
    proc.stdout.emit('end');
    proc.stderr.emit('end');
    proc.emit('close', 0);
    await expect(p).resolves.toBe('git version 2.40.0');
  });
});

describe('GitService.openHistory streaming reader', () => {
  let service: GitService;
  let proc: ReturnType<typeof fakeProc>;

  const record = (hash: string, subject: string) => [
    hash,
    hash.slice(0, 7),
    'Author',
    'author@example.com',
    '2026-01-01T00:00:00Z',
    'Committer',
    'committer@example.com',
    '2026-01-01T00:00:00Z',
    subject,
    '',
    '',
    '',
  ].join('\x00') + '\x00';

  beforeEach(() => {
    service = new GitService('/tmp/test-repo');
    proc = fakeProc();
    spawnMock.mockReturnValue(proc as unknown as ReturnType<typeof childProcess.spawn>);
    (service as unknown as { getRemoteNames: () => Promise<string[]> }).getRemoteNames = vi.fn(async () => ['origin']);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('parses records across chunk boundaries from one git log process', async () => {
    const reader = await service.openHistory({ sortOrder: 'topological' });
    const raw = `${record('aaaaaaaa', 'first')}${record('bbbbbbbb', 'second')}`;
    proc.stdout.emit('data', raw.slice(0, 2));
    proc.stdout.emit('data', raw.slice(2, 47));
    proc.stdout.emit('data', raw.slice(47));
    proc.emit('close', 0);

    await expect(reader.next()).resolves.toMatchObject({ hash: 'aaaaaaaa', subject: 'first' });
    await expect(reader.next()).resolves.toMatchObject({ hash: 'bbbbbbbb', subject: 'second' });
    await expect(reader.next()).resolves.toBeNull();
    expect(spawnMock).toHaveBeenCalledTimes(1);
    const args = spawnMock.mock.calls[0][1] as string[];
    expect(args.some(arg => arg.startsWith('--skip='))).toBe(false);
    expect(args.some(arg => arg.startsWith('--max-count='))).toBe(false);
  });

  it('kills the process and rejects a pending read when disposed', async () => {
    const reader = await service.openHistory({ sortOrder: 'topological' });
    const pending = reader.next();
    reader.dispose();

    await expect(pending).rejects.toThrow(/cancelled/);
    expect(proc.kill).toHaveBeenCalledWith('SIGTERM');
  });

  it('times out and kills a stalled active read without timing out an idle session', async () => {
    vi.useFakeTimers();
    service.setDefaultTimeout(20);
    const reader = await service.openHistory({ sortOrder: 'topological' });
    // Merely opening the reader starts no timeout; it begins when MainPanel
    // requests the next commit.
    await vi.advanceTimersByTimeAsync(100);
    expect(proc.kill).not.toHaveBeenCalled();

    const pending = reader.next();
    const assertion = expect(pending).rejects.toThrow(/timed out after 20ms/);
    await vi.advanceTimersByTimeAsync(20);
    await assertion;
    expect(proc.kill).toHaveBeenCalledWith('SIGTERM');
    vi.useRealTimers();
  });

  it('surfaces a non-zero git exit to the reader', async () => {
    const reader = await service.openHistory({ sortOrder: 'topological' });
    const pending = reader.next();
    proc.stderr.emit('data', 'fatal: bad revision');
    proc.emit('close', 128);

    await expect(pending).rejects.toThrow(/bad revision/);
  });

  it('handles stdout pipe errors without an uncaught stream exception', async () => {
    const reader = await service.openHistory({ sortOrder: 'topological' });
    const pending = reader.next();
    proc.stdout.emit('error', new Error('stdout pipe broke'));

    await expect(pending).rejects.toThrow(/stdout pipe broke/);
    expect(proc.kill).toHaveBeenCalledWith('SIGTERM');
  });

  it('keeps the child error listener until close after a stream failure', async () => {
    const reader = await service.openHistory({ sortOrder: 'topological' });
    const pending = reader.next();
    proc.stdout.emit('error', new Error('first pipe failure'));
    await expect(pending).rejects.toThrow(/first pipe failure/);

    expect(() => proc.emit('error', new Error('later child failure'))).not.toThrow();
    proc.emit('close', null);
  });

  it('handles stderr pipe errors without an uncaught stream exception', async () => {
    const reader = await service.openHistory({ sortOrder: 'topological' });
    const pending = reader.next();
    proc.stderr.emit('error', new Error('stderr pipe broke'));

    await expect(pending).rejects.toThrow(/stderr pipe broke/);
    expect(proc.kill).toHaveBeenCalledWith('SIGTERM');
  });

  it('rejects and kills git when one streamed record exceeds the memory bound', async () => {
    const reader = await service.openHistory({ sortOrder: 'topological' });
    const pending = reader.next();
    proc.stdout.emit('data', `\x01\x02\x03${'x'.repeat(16 * 1024 * 1024 + 1)}`);

    await expect(pending).rejects.toThrow(/commit record exceeded/);
    expect(proc.kill).toHaveBeenCalledWith('SIGTERM');
  });

  it('pauses and resumes stdout to keep buffered commits bounded', async () => {
    const reader = await service.openHistory({ sortOrder: 'topological' });
    proc.stdout.emit('data', Array.from({ length: 300 }, (_, index) =>
      record(String(index).padStart(8, '0'), `commit ${index}`)
    ).join(''));

    expect(proc.stdout.pause).toHaveBeenCalled();
    for (let index = 0; index < 236; index++) await reader.next();
    expect(proc.stdout.resume).toHaveBeenCalled();
    reader.dispose();
  });
});
