import { describe, expect, it } from 'bun:test';

import { parseAgendaHeading } from './agenda-heading.ts';

describe('parseAgendaHeading', () => {
  it('splits agenda item, paper reference and title', () => {
    expect(parseAgendaHeading('19.14.3 VIIl-DS-02149-ÄA-03 Rahmenrichtlinie als Grundlage')).toEqual({
      agendaItemNumber: '19.14.3',
      paperReference: 'VIII-DS-02149-ÄA-03',
      title: 'Rahmenrichtlinie als Grundlage',
    });
  });

  it('accepts a reference without suffix', () => {
    expect(parseAgendaHeading('19.13 VIII-DS-01507 Stadtentwicklungsplan')).toMatchObject({
      agendaItemNumber: '19.13',
      paperReference: 'VIII-DS-01507',
    });
  });

  it('accepts a roman numeral that OCR shortened', () => {
    expect(parseAgendaHeading('19.14.2 VIl-DS-02149-ÄA-02 Rahmenrichtlinie').paperReference).toEqual(
      'VIII-DS-02149-ÄA-02',
    );
    expect(parseAgendaHeading('19.18 VIIIl-DS-02188 Planungs- und Baubeschluss').paperReference).toEqual(
      'VIII-DS-02188',
    );
  });

  it('keeps the case of paper kinds such as Ifo', () => {
    expect(parseAgendaHeading('20.3.1 VIll-Ifo-03193-ÄA-01 Schulbaustrategie').paperReference).toEqual(
      'VIII-Ifo-03193-ÄA-01',
    );
  });

  it('reads the older reference style with one-digit suffixes', () => {
    expect(parseAgendaHeading('19.3.1 VIll-DS-01694-Ifo-1-NF-1-ÄA-1 Kosten der Unterkunft')).toMatchObject({
      agendaItemNumber: '19.3.1',
      paperReference: 'VIII-DS-01694-Ifo-1-NF-1-ÄA-1',
      title: 'Kosten der Unterkunft',
    });
  });

  it('accepts several suffixes and OCR spacing', () => {
    expect(parseAgendaHeading('21.2 VII1 - A - 00123 - NF - 01 - ÄA - 02 Antrag')).toMatchObject({
      agendaItemNumber: '21.2',
      paperReference: 'VIII-A-00123-NF-01-ÄA-02',
      title: 'Antrag',
    });
  });

  it('keeps headings without paper', () => {
    expect(parseAgendaHeading('3 Feststellung der Tagesordnung')).toEqual({
      agendaItemNumber: '3',
      paperReference: null,
      title: 'Feststellung der Tagesordnung',
    });
  });

  it('returns the raw text when there is no agenda number', () => {
    expect(parseAgendaHeading('Anwesenheit')).toEqual({
      agendaItemNumber: null,
      paperReference: null,
      title: 'Anwesenheit',
    });
  });

  it('repairs a doubled letter in the paper kind', () => {
    expect(parseAgendaHeading('19.1 VIll-Iffo-01304-NF-01 Mehr Wohnen').paperReference).toEqual('VIII-Ifo-01304-NF-01');
  });
});
