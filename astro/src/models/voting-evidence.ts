// A vote keeps its address on the site by its position in the session's scan, and its quotation image is named after
// it, so the site finds the image of a vote without a list of images.
export function votingFilenameOf(
  sessionId: string,
  votingIndex: number,
): string {
  return `${sessionId}-${String(votingIndex + 1).padStart(3, '0')}.png`;
}

export function quotationImageNameOf(votingFilename: string): string {
  return votingFilename.replace(/\.png$/, '-zitat.png');
}
