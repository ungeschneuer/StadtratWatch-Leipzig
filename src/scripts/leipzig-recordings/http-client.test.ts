import { describe, expect, it } from 'bun:test';

import { getTextOrThrow, getTextRevalidated, type HttpClient, type HttpResponse } from './http-client.ts';
import { createMemoryJsonStore } from './json-file-store.ts';

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

describe('getTextRevalidated', () => {
  const url = 'https://opendata.example/candidates.csv';

  function recordingClient(...answers: HttpResponse[]) {
    const requests: Record<string, string>[] = [];
    const client: HttpClient = {
      getText(_url, requestHeaders = {}) {
        requests.push(requestHeaders);
        return Promise.resolve(answers[Math.min(requests.length - 1, answers.length - 1)]);
      },
      postJson: () => Promise.resolve(null),
    };
    return { client, requests };
  }

  it('sends the validators of the stored copy and reuses it on 304', async () => {
    const store = createMemoryJsonStore();
    const { client, requests } = recordingClient(
      { status: 200, body: 'name;list', headers: { ETag: '"v1"', 'Last-Modified': 'Tue, 01 Oct 2024 10:00:00 GMT' } },
      { status: 304, body: '' },
    );

    expect(await getTextRevalidated(client, url, store, [])).toEqual({ body: 'name;list', notModified: false });
    expect(await getTextRevalidated(client, url, store, [])).toEqual({ body: 'name;list', notModified: true });
    expect(requests).toEqual([{}, { 'If-None-Match': '"v1"', 'If-Modified-Since': 'Tue, 01 Oct 2024 10:00:00 GMT' }]);
  });

  it('stores a changed file', async () => {
    const store = createMemoryJsonStore();
    const { client } = recordingClient(
      { status: 200, body: 'old', headers: { etag: '"v1"' } },
      { status: 200, body: 'new', headers: { etag: '"v2"' } },
      { status: 304, body: '' },
    );

    await getTextRevalidated(client, url, store, []);
    expect(await getTextRevalidated(client, url, store, [])).toEqual({ body: 'new', notModified: false });
    expect(await getTextRevalidated(client, url, store, [])).toEqual({ body: 'new', notModified: true });
  });

  it('does not accept 304 without a stored copy', async () => {
    const { client } = recordingClient({ status: 304, body: '' });

    await expect(getTextRevalidated(client, url, createMemoryJsonStore(), [])).rejects.toThrow('answered 304');
  });
});
