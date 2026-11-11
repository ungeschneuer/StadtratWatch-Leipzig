import { useEffect, useRef } from 'react';
import Hls from 'hls.js';
import styles from './leipzig.module.css';

export interface SeekRequest {
  seconds: number;
  // Counts the requests, so jumping to the same time twice still seeks.
  sequence: number;
}

interface Props {
  hlsUrl: string;
  available: boolean;
  seek: SeekRequest | null;
}

// The stream hoster allows cross-origin requests, so the recording plays here and jumps to the vote being reviewed.
export function VideoPlayer({ hlsUrl, available, seek }: Props) {
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const element = video.current;
    if (!element || !available) return;
    if (element.canPlayType('application/vnd.apple.mpegurl')) {
      element.src = hlsUrl;
      return;
    }
    if (!Hls.isSupported()) return;
    const hls = new Hls({ startLevel: 0 });
    hls.loadSource(hlsUrl);
    hls.attachMedia(element);
    return () => hls.destroy();
  }, [hlsUrl, available]);

  useEffect(() => {
    const element = video.current;
    if (!element || !seek) return;
    element.currentTime = seek.seconds;
    void element.play().catch(() => undefined);
  }, [seek]);

  if (!available) {
    return <p className={styles.notice}>Die Aufzeichnung ist nicht mehr in der Mediathek. Bitte die Belegbilder nutzen.</p>;
  }
  return <video ref={video} className={styles.video} controls preload="none" />;
}
