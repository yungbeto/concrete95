/** ISO build timestamp injected at compile time via next.config. */
export const BUILD_DATE_ISO = process.env.NEXT_PUBLIC_BUILD_DATE;

export function formatBuildDate(iso: string | undefined = BUILD_DATE_ISO): string {
  if (!iso) return 'Unknown';
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
