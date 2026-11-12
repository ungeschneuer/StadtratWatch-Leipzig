import { describe, expect, it, vi } from 'vitest';
import { sitePath } from './site-path';

describe('sitePath', () => {
  it('prefixes the base path once, with or without slashes', () => {
    vi.stubEnv('BASE_URL', '/StadtratWatch-Leipzig/');
    expect(sitePath('/pp/leipzig-8')).toBe(
      '/StadtratWatch-Leipzig/pp/leipzig-8',
    );
    expect(sitePath('pp/leipzig-8')).toBe(
      '/StadtratWatch-Leipzig/pp/leipzig-8',
    );
    vi.unstubAllEnvs();
  });

  it('keeps root paths when the site is served at the root', () => {
    vi.stubEnv('BASE_URL', '/');
    expect(sitePath('/impressum')).toBe('/impressum');
    expect(sitePath('/')).toBe('/');
    vi.unstubAllEnvs();
  });
});
