export class DeadlineExceededError extends Error {}

// Rejects when the work takes longer than allowed, so a stalled step fails visibly instead of blocking the run forever.
// The work itself is not cancelled; whatever it waits on (ffmpeg, network) has its own timeout.
export function withDeadline<T>(work: Promise<T>, milliseconds: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new DeadlineExceededError(`${label} took longer than ${Math.round(milliseconds / 1000)}s`)),
      milliseconds,
    );
  });
  return Promise.race([work, deadline]).finally(() => clearTimeout(timer));
}
