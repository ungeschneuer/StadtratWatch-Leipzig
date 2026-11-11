import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import type { ReviewCasesFile, ReviewIndex } from '@srw-astro/models/leipzig-review';

import { renderReviewIssue } from './review-issue.ts';

// Writes one issue body per session with review cases, for the workflow that opens, updates and closes the issues.
const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    'data-dir': { type: 'string', default: 'data/leipzig-8/' },
    'out-dir': { type: 'string', default: 'output/leipzig-review-issues/' },
    'review-ui-url': { type: 'string' },
  },
});
if (!values['review-ui-url']) {
  console.error('Usage: bun review-issues.ts --review-ui-url <url> [--data-dir <dir>] [--out-dir <dir>]');
  process.exit(1);
}

const index = JSON.parse(await readFile(join(values['data-dir'], 'review-index.json'), 'utf-8')) as ReviewIndex;
await mkdir(values['out-dir'], { recursive: true });
const issues = [];
for (const session of index.sessions.filter((candidate) => candidate.cases > 0)) {
  const file = JSON.parse(
    await readFile(join(values['data-dir'], session.sessionId, `review-${session.sessionId}.json`), 'utf-8'),
  ) as ReviewCasesFile;
  const issue = renderReviewIssue(file, values['review-ui-url']);
  const bodyFile = join(values['out-dir'], `${session.sessionId}.md`);
  await writeFile(bodyFile, `${issue.body}\n`);
  issues.push({ sessionId: issue.sessionId, title: issue.title, open: issue.open, bodyFile });
}
await writeFile(join(values['out-dir'], 'issues.json'), `${JSON.stringify(issues, null, 2)}\n`);
console.log(`${issues.length} review issue(s) written to ${values['out-dir']}`);
