import { expect, test } from 'vitest';
import { reviewCaseNumberOf, votingReportLinks } from './voting-report';

const input = {
  pageUrl:
    'https://example.org/wahlperiode-8/sitzung/2026-10-29/abstimmung/19.13/',
  sessionDate: '29.10.2026',
  agendaItem: '19.13',
  itemNumber: '2',
  paperReference: 'VIII-DS-02186',
  title: 'Masterplan Grün',
  repositoryUrl: 'https://github.com/owner/repo',
  contactEmail: 'hallo@example.org',
};

test('prefills an issue and a mail with the vote', () => {
  const { issueUrl, mailUrl } = votingReportLinks(input);
  const issue = new URL(issueUrl);

  expect(issue.pathname).toEqual('/owner/repo/issues/new');
  expect(issue.searchParams.get('title')).toEqual(
    'Hinweis zur Abstimmung vom 29.10.2026, TOP 19.13, Punkt 2',
  );
  expect(issue.searchParams.get('body')).toContain(
    'Vorlage: VIII-DS-02186, Masterplan Grün',
  );
  expect(issue.searchParams.get('body')).toContain(input.pageUrl);
  expect(
    mailUrl.startsWith(
      'mailto:hallo@example.org?subject=Hinweis%20zur%20Abstimmung',
    ),
  ).toBe(true);
  expect(mailUrl).not.toContain('+');
});

test('reads the review case number from the evidence file name', () => {
  expect(reviewCaseNumberOf('2026-10-29-005.png')).toEqual(4);
  expect(reviewCaseNumberOf('anders.png')).toBeNull();
});
