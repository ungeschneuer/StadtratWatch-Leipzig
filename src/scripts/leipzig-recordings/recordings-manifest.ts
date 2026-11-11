export type Recording = {
  sessionId: string;
  date: string;
  oparlMeetingId: string | null;
  meetingName: string | null;
  mediathekUrl: string;
  pageTitle: string;
  serverApp: string;
  streamName: string;
  hlsUrl: string;
  durationSeconds: number | null;
  subtitleUrl: string | null;
  subtitleFile: string | null;
  subtitleSha256: string | null;
  firstSeen: string;
  goneSince: string | null;
};

export type ObservedRecording = Omit<Recording, 'firstSeen' | 'goneSince'>;

export type RecordingsManifest = {
  description: string;
  sources: string[];
  recordings: Recording[];
};

export function createEmptyManifest(): RecordingsManifest {
  return {
    description:
      'Aufzeichnungen der Leipziger Ratsversammlung in der Mediathek der Stadt Leipzig, je Sitzungstag eine Zeile. ' +
      'firstSeen ist der Tag, an dem die Aufzeichnung zuerst gefunden wurde; goneSince der Tag, ab dem sie nicht mehr abrufbar war.',
    sources: [
      'https://www.leipzig.de/mediathek/video',
      'https://www.leipzig.sitzung-online.de/oparl/system (OParl, CC BY 4.0, Stadt Leipzig)',
    ],
    recordings: [],
  };
}

export function upsertObservedRecording(
  manifest: RecordingsManifest,
  observed: ObservedRecording,
  today: string,
): RecordingsManifest {
  const existing = manifest.recordings.find((recording) => recording.sessionId === observed.sessionId);
  const updated: Recording = {
    ...observed,
    subtitleFile: observed.subtitleFile ?? existing?.subtitleFile ?? null,
    subtitleSha256: observed.subtitleSha256 ?? existing?.subtitleSha256 ?? null,
    firstSeen: existing?.firstSeen ?? today,
    goneSince: null,
  };
  return withRecordings(manifest, [
    ...manifest.recordings.filter((recording) => recording.sessionId !== observed.sessionId),
    updated,
  ]);
}

export function markRecordingGone(manifest: RecordingsManifest, sessionId: string, today: string): RecordingsManifest {
  return withRecordings(
    manifest,
    manifest.recordings.map((recording) =>
      recording.sessionId === sessionId && recording.goneSince === null
        ? { ...recording, goneSince: today }
        : recording,
    ),
  );
}

export function serializeManifest(manifest: RecordingsManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

const CSV_COLUMNS: (keyof Recording)[] = [
  'sessionId',
  'date',
  'oparlMeetingId',
  'meetingName',
  'mediathekUrl',
  'pageTitle',
  'serverApp',
  'streamName',
  'hlsUrl',
  'durationSeconds',
  'subtitleUrl',
  'subtitleFile',
  'subtitleSha256',
  'firstSeen',
  'goneSince',
];

export function manifestToCsv(manifest: RecordingsManifest): string {
  const rows = manifest.recordings.map((recording) => CSV_COLUMNS.map((column) => toCsvField(recording[column])));
  return [CSV_COLUMNS.join(','), ...rows.map((row) => row.join(','))].join('\n') + '\n';
}

function withRecordings(manifest: RecordingsManifest, recordings: Recording[]): RecordingsManifest {
  return { ...manifest, recordings: [...recordings].sort((a, b) => a.sessionId.localeCompare(b.sessionId)) };
}

function toCsvField(value: string | number | null): string {
  if (value === null) {
    return '';
  }
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
