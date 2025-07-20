'use server';

export type FreesoundSound = {
  id: number;
  name: string;
  previewUrl: string;
};

export async function searchFreesound(
  query: string
): Promise<FreesoundSound[] | {error: string}> {
  try {
    // Construct an absolute URL for the API proxy route.
    // This is necessary because server actions may run in a different context.
    const baseUrl = process.env.NEXT_PUBLIC_VERCEL_URL
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
      : 'http://localhost:3000';
    const proxyUrl = new URL('/api/freesound-proxy', baseUrl);
    proxyUrl.searchParams.append('query', query);

    const response = await fetch(proxyUrl.toString(), {
      cache: 'no-store', // Ensure we get fresh results
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {error: errorData.error || `Request failed with status ${response.status}`};
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to fetch from freesound proxy:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return {error: errorMessage};
  }
}
