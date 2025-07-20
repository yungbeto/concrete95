'use server';

// The base URL for our app, used for the proxy
const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002';

export type FreesoundSound = {
  id: number;
  name: string;
  previewUrl: string;
};

export async function searchFreesound(
  query: string
): Promise<FreesoundSound[] | {error: string}> {
  try {
    const response = await fetch(`${APP_BASE_URL}/api/freesound-proxy?query=${query}`, {
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
