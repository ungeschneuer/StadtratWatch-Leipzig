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
      text: 'Video ab 0:11:42',
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
      text: 'Aufzeichnung (Mediathek)',
    });
  });

  it('links the player page at the given second where there is one', () => {
    const session = {
      youtubeUrl: '',
      video: {
        url: 'https://www.leipzig.de/mediathek/x',
        label: 'Mediathek',
        playerUrl: 'https://player.example/p.html?smil=2026/a.smil&autostart=0',
      },
    };
    expect(sessionVideoLink(session, 702.6)?.url).toEqual(
      'https://player.example/p.html?smil=2026%2Fa.smil&autostart=1&startsekunde=702',
    );
    expect(sessionVideoLink(session)?.url).toEqual(
      'https://www.leipzig.de/mediathek/x',
    );
  });

  it('counts the player time from where the city cut the recording', () => {
    const session = {
      youtubeUrl: '',
      video: {
        url: 'https://www.leipzig.de/mediathek/x',
        label: 'Mediathek',
        playerUrl: 'https://player.example/p.html?videostartoffset=660',
      },
    };
    expect(sessionVideoLink(session, 1000)?.url).toContain('startsekunde=340');
    expect(sessionVideoLink(session, 100)?.url).toContain('startsekunde=0');
  });

  it('gives no link without a recording', () => {
    expect(sessionVideoLink({ youtubeUrl: '' })).toBeNull();
  });

  it('says from when the video plays where the player jumps to the time', () => {
    const link = sessionVideoLink(
      {
        youtubeUrl: '',
        video: {
          url: 'https://www.leipzig.de/mediathek/x',
          label: 'Mediathek',
          playerUrl: 'https://player.example/p.html?videostartoffset=1',
        },
      },
      3725,
    );
    expect(link?.text).toBe('Video ab 1:02:05');
  });
});
