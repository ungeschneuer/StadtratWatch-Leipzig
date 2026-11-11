import { describe, expect, it } from 'bun:test';

import { getTextOrThrow, type HttpClient, type HttpResponse } from './http-client.ts';

function clientAnswering(...answers: (HttpResponse | Error)[]): HttpClient & { calls: number } {
  const client = {
    calls: 0,
    getText() {
      const answer = answers[Math.min(client.calls++, answers.length - 1)];
      return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
    },
    postJson: () => Promise.resolve(null),
  };
  return client;
}

describe('getTextOrThrow', () => {
  it('retries timeouts and server errors', async () => {
    const client = clientAnswering(new Error('timed out'), { status: 503, body: '' }, { status: 200, body: 'ok' });

    expect(await getTextOrThrow(client, 'https://example.org', [0, 0])).toEqual('ok');
    expect(client.calls).toEqual(3);
  });

  it('gives up after the last retry', async () => {
    const client = clientAnswering({ status: 502, body: '' });

    await expect(getTextOrThrow(client, 'https://example.org', [0, 0])).rejects.toThrow('answered 502');
  });

  it('does not retry a missing page', async () => {
    const client = clientAnswering({ status: 404, body: '' }, { status: 200, body: 'ok' });

    await expect(getTextOrThrow(client, 'https://example.org', [0, 0])).rejects.toThrow('answered 404');
    expect(client.calls).toEqual(1);
  });
});
