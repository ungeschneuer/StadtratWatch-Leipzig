import { describe, expect, it } from 'bun:test';

import { DeadlineExceededError, withDeadline } from './deadline.ts';

describe('withDeadline', () => {
  it('passes the result of work that finishes in time', async () => {
    expect(await withDeadline(Promise.resolve(42), 50, 'quick')).toEqual(42);
  });

  it('fails work that never finishes', async () => {
    const never = new Promise<number>(() => undefined);

    await expect(withDeadline(never, 20, 'vote #3')).rejects.toThrow(DeadlineExceededError);
    await expect(withDeadline(never, 20, 'vote #3')).rejects.toThrow('vote #3 took longer than 0s');
  });

  it('passes errors of the work through', async () => {
    await expect(withDeadline(Promise.reject(new Error('broken')), 50, 'x')).rejects.toThrow('broken');
  });
});
