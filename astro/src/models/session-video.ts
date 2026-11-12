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
      url: session.video.url,
      label: session.video.label,
      icon: 'lucide--video',
    };
  }
  return null;
}
