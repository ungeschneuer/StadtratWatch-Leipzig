import type { RegistrySession } from './registry.ts';

// text says what the link does: „Video ab 1:02:05“ where it jumps to the time, „Aufzeichnung (Mediathek)“ where the
// platform can only open the whole recording.
export type SessionVideoLink = {
  url: string;
  label: string;
  icon: string;
  text: string;
};

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
      text: linkText('YouTube', seconds),
    };
  }
  if (session.video) {
    const jumpsToTime = seconds !== undefined && !!session.video.playerUrl;
    return {
      url: jumpsToTime
        ? playerUrlAt(session.video.playerUrl as string, seconds)
        : session.video.url,
      label: session.video.label,
      icon: 'lucide--video',
      text: linkText(session.video.label, jumpsToTime ? seconds : undefined),
    };
  }
  return null;
}

function linkText(label: string, seconds: number | undefined): string {
  return seconds === undefined
    ? `Aufzeichnung (${label})`
    : `Video ab ${clockTime(seconds)}`;
}

function clockTime(seconds: number): string {
  const whole = Math.floor(seconds);
  const minutesAndSeconds = [Math.floor((whole % 3600) / 60), whole % 60]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
  return `${Math.floor(whole / 3600)}:${minutesAndSeconds}`;
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
