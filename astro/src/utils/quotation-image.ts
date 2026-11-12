import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { quotationImageNameOf } from '@models/voting-evidence';
import { sitePath } from '@utils/site-path';

// The deploy fetches the images into public/evidence/ before the build; a vote without its image shows none.
export function quotationImageUrl(
  sessionId: string,
  votingFilename: string,
  publicDirectory = join(process.cwd(), 'public'),
): string | null {
  const relativePath = `evidence/${sessionId}/${quotationImageNameOf(votingFilename)}`;
  return existsSync(join(publicDirectory, relativePath))
    ? sitePath(relativePath)
    : null;
}
