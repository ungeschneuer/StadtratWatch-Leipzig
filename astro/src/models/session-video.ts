import type { RegistrySession } from './registry.ts';

export type SessionVideoLink = { url: string; label: string; icon: string };

// The link to a session's recording, at the given second where the video platform allows it.
export function sessionVideoLink(
  session: Pick<RegistrySession, 'youtubeUrl' | 'video'>,
  seconds?: number,
): SessionVideoLink | null {
  if (session.youtubeUrl) {
    return {
      url:
        seconds === undefined
          ? session.youtubeUrl
          : `${session.youtubeUrl}?t=${seconds}s`,
      label: 'YouTube',
      icon: 'lucide--youtube',
    };
  }
  if (session.video) {
    return {
      url:
        seconds !== undefined && session.video.playerUrl
          ? playerUrlAt(session.video.playerUrl, seconds)
          : session.video.url,
      label: session.video.label,
      icon: 'lucide--video',
    };
  }
  return null;
}

// The city cuts the waiting time before a session with `videostartoffset`: the hoster then serves the stream from that
// second on, so the player's clock runs that far behind the full recording our times refer to.
function playerUrlAt(playerUrl: string, seconds: number): string {
  const url = new URL(playerUrl);
  const cutSeconds = Number(url.searchParams.get('videostartoffset')) || 0;
  const playerSeconds = Math.max(0, Math.floor(seconds - cutSeconds));
  url.searchParams.set('startsekunde', String(playerSeconds));
  url.searchParams.set('autostart', '1');
  return url.toString();
}
