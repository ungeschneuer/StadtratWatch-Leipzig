import { describe, expect, it } from 'bun:test';

import type { TextWorkers } from './board-text.ts';
import {
  announcementsAround,
  type ExtractionTools,
  extractSessionVotings,
  findRepeatCall,
  type ReadVoting,
  relinkAgendaItemsByPaper,
  resultSearchSeconds,
  seatsWithoutOwnPerson,
  type SessionInputs,
} from './extract-session.ts';
import type { VideoReader } from './ffmpeg.ts';
import type { AgendaItem } from './oparl-council.ts';

const hangingVideo: VideoReader = {
  // deno-lint-ignore require-yield
  async *scanFrames() {
    await new Promise(() => undefined);
  },
  grabFramePng: () => new Promise(() => undefined),
};

const inputs: SessionInputs = {
  sessionId: '2026-10-29',
  hdVideoUrl: 'https://stream.example/1080p.m3u8',
  events: [
    { startSeconds: 100, endSeconds: 106 },
    { startSeconds: 300, endSeconds: 306 },
  ],
  roster: [],
  agenda: [],
  cues: null,
};

function tools(overrides: Partial<ExtractionTools> = {}): ExtractionTools {
  return {
    video: hangingVideo,
    workers: {} as TextWorkers,
    fetchJson: () => Promise.resolve({}),
    log: { info: () => undefined, warn: () => undefined },
    voteDeadlineMilliseconds: 50,
    ...overrides,
  };
}

describe('extractSessionVotings', () => {
  it('leaves a vote that hangs to the review and goes on with the next', async () => {
    const votings = await extractSessionVotings(inputs, tools());

    expect(votings.map((voting) => voting.status)).toEqual(['needs-review', 'needs-review']);
    expect(votings[0].checks[0].detail).toContain('vote #0 took longer than');
  });

  it('stops without a result when the session deadline has passed', async () => {
    const aborted = AbortSignal.abort();

    await expect(extractSessionVotings(inputs, tools({ signal: aborted }))).rejects.toThrow(
      'stopped before vote #0, the session took too long',
    );
  });
});

describe('relinkAgendaItemsByPaper', () => {
  // 2026-03-26: the board counts the amendments of TOP 19.5 one lower than OParl, which lists the erledigt ÄA-01.
  const item = (number: string, paper: string, result: string): AgendaItem & { paper: string } => ({
    agendaItemId: `item-${number}`,
    number,
    name: 'Eigenheime für Leipzig',
    result,
    consultationUrl: `consultation-${number}`,
    paper,
  });
  const agenda = [
    item('19.5', 'VIII-DS-01619-NF-02', 'geändert beschlossen'),
    item('19.5.2', 'VIII-DS-01619-NF-02-ÄA-02', 'abgelehnt'),
    item('19.5.3', 'VIII-DS-01619-NF-02-ÄA-03', 'abgelehnt'),
  ];
  const paperOf = (agendaItem: AgendaItem) =>
    Promise.resolve(agenda.find((candidate) => candidate.agendaItemId === agendaItem.agendaItemId)?.paper ?? null);

  function voting(boardPaper: string): Pick<ReadVoting, 'heading' | 'oparl'> {
    return {
      heading: { raw: '', agendaItemNumber: '19.5.3', paperReference: boardPaper, title: '' },
      oparl: {
        agendaItemId: 'item-19.5.3',
        number: '19.5.3',
        isParentAgendaItem: false,
        name: '',
        result: 'abgelehnt',
        paperReference: 'VIII-DS-01619-NF-02-ÄA-03',
      },
    };
  }

  it("links the sibling item that has the board's paper", async () => {
    const shifted = voting('VIII-DS-01619-NF-02-ÄA-02');
    await relinkAgendaItemsByPaper([shifted as ReadVoting], agenda, paperOf);

    expect(shifted.oparl).toMatchObject({ number: '19.5.2', matchedByPaper: true, result: 'abgelehnt' });
  });

  it("keeps the link when no sibling has the board's paper", async () => {
    const unknown = voting('VIII-DS-01619-NF-02-ÄA-09');
    await relinkAgendaItemsByPaper([unknown as ReadVoting], agenda, paperOf);

    expect(unknown.oparl?.number).toEqual('19.5.3');
    expect(unknown.oparl?.matchedByPaper).toBeUndefined();
  });
});

describe('announcementsAround', () => {
  // 2026-03-25: „58 zu 0 zu 0“ belongs to the vote at 1131 s; its cue runs on into the window of the vote at 1167 s.
  const cues = [{ startSeconds: 1122, endSeconds: 1141, text: 'Das Ergebnis ist einstimmig, 58 zu 0 zu 0.' }];

  it('leaves an announcement that began before the previous board ended to that vote', () => {
    expect(
      announcementsAround(
        cues,
        { startSeconds: 1167, endSeconds: 1170 },
        { startSeconds: 1131, endSeconds: 1137.5 },
        undefined,
      ),
    ).toEqual([]);
  });

  it('keeps an announcement whose cue began while the previous board was still up', () => {
    // 2026-05-28: the cue with the result of the vote at 4460 s starts at 4439 s, as the previous board (4435–4439.5)
    // goes.
    const cue = [
      { startSeconds: 4439, endSeconds: 4465, text: 'Dann der Punkt Römisch 1-2 … 35 zu 26 zu 1, so beschlossen.' },
    ];
    expect(
      announcementsAround(
        cue,
        { startSeconds: 4460, endSeconds: 4465 },
        { startSeconds: 4435, endSeconds: 4439.5 },
        undefined,
      ),
    ).toMatchObject([{ J: 35, N: 26, E: 1 }]);
  });

  it('finds the announcement of its own vote', () => {
    expect(announcementsAround(cues, { startSeconds: 1131, endSeconds: 1137.5 }, undefined, undefined)).toMatchObject([
      { J: 58, N: 0, E: 0 },
    ]);
  });
});

describe('findRepeatCall', () => {
  it('finds the chair repeating a vote before the next board', () => {
    // 2026-09-30, TOP 14.15.
    const cues = [
      { startSeconds: 11389, endSeconds: 11400, text: 'Ich wiederhole noch einmal die Abstimmung, bitte noch einmal.' },
    ];

    expect(
      findRepeatCall(cues, { startSeconds: 11382, endSeconds: 11392 }, { startSeconds: 11429.5, endSeconds: 11440 }),
    ).toMatchObject({
      seconds: 11389,
    });
  });

  it('does not take a request to a person for a repeated vote', () => {
    const cues = [
      {
        startSeconds: 150,
        endSeconds: 155,
        text: 'Ende der Debatte heisst aber nicht, dass ich Frau Jenigel noch einmal bitte,',
      },
    ];

    expect(
      findRepeatCall(cues, { startSeconds: 100, endSeconds: 105 }, { startSeconds: 200, endSeconds: 205 }),
    ).toBeNull();
  });

  it('ignores the call after the next board and the last vote', () => {
    const cues = [{ startSeconds: 2766, endSeconds: 2768, text: 'Komm, Lösch noch mal, mach neu.' }];

    expect(
      findRepeatCall(cues, { startSeconds: 100, endSeconds: 105 }, { startSeconds: 200, endSeconds: 205 }),
    ).toBeNull();
    expect(findRepeatCall(cues, { startSeconds: 2748, endSeconds: 2768 }, undefined)).toBeNull();
  });
});

describe('resultSearchSeconds', () => {
  it('tries the result phase first, then seconds before and after it', () => {
    expect(resultSearchSeconds({ startSeconds: 100.5, endSeconds: 103 }).slice(0, 6)).toEqual([
      101, 102, 103, 99, 104, 98,
    ]);
  });
});

describe('seatsWithoutOwnPerson', () => {
  const heymann = { personId: 'p/1', name: 'Sabine Heymann' };
  const streller = { personId: 'p/2', name: 'Ute Streller' };

  it('lists nothing when every seat has a person of its own', () => {
    expect(
      seatsWithoutOwnPerson([
        { boardName: 'Heymann, Sabine', person: heymann },
        { boardName: 'Streller, Ute', person: streller },
      ]),
    ).toEqual([]);
  });

  it('lists seats without a person and seats that share one', () => {
    expect(
      seatsWithoutOwnPerson([
        { boardName: 'Heymann, Sabine', person: heymann },
        { boardName: 'Heyrnann, Sabine', person: heymann },
        { boardName: '[ia', person: null, reason: 'no roster name close to "[ia"' },
      ]),
    ).toEqual([
      'no roster name close to "[ia"',
      '"Heymann, Sabine" shares Sabine Heymann with another seat',
      '"Heyrnann, Sabine" shares Sabine Heymann with another seat',
    ]);
  });
});
