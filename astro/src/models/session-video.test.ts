import { describe, expect, it } from 'vitest';
import { sessionVideoLink } from './session-video.ts';

describe('sessionVideoLink', () => {
  it('links YouTube at the given second', () => {
    expect(
      sessionVideoLink({ youtubeUrl: 'https://youtu.be/abc' }, 702),
    ).toEqual({
      url: 'https://youtu.be/abc?t=702s',
      label: 'YouTube',
      icon: 'lucide--youtube',
    });
  });

  it('links another platform without a time', () => {
    expect(
      sessionVideoLink(
        {
          youtubeUrl: '',
          video: {
            url: 'https://www.leipzig.de/mediathek/x',
            label: 'Mediathek',
          },
        },
        702,
      ),
    ).toEqual({
      url: 'https://www.leipzig.de/mediathek/x',
      label: 'Mediathek',
      icon: 'lucide--video',
    });
  });

  it('gives no link without a recording', () => {
    expect(sessionVideoLink({ youtubeUrl: '' })).toBeNull();
  });
});
