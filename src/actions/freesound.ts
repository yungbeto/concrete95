
'use server';

export type FreesoundSound = {
  id: number;
  name: string;
  previewUrl: string;
};

/** User-facing / API errors we handle — avoid logging these as crashes in dev. */
function isOperationalFreesoundMessage(message: string): boolean {
  return (
    message.includes('timed out') ||
    message.startsWith('Freesound:') ||
    message.startsWith('Freesound request failed')
  );
}

async function fetchFromFreesound(query: string, retries = 2) {
  const apiKey = process.env.FREESOUND_API_KEY;

  if (!apiKey) {
    throw new Error('Freesound API key is not configured. Please check your environment variables.');
  }

  // Random page offset so repeated calls return different sounds from the pool
  const page = Math.floor(Math.random() * 4) + 1;

  const freesoundUrl = `https://freesound.org/apiv2/search/text/?query=${encodeURIComponent(
    query || ''
  )}&filter=duration:[10%20TO%2090]%20license:"Creative%20Commons%200"&fields=id,name,previews&sort=created_desc&page_size=50&page=${page}&token=${apiKey}`;

  try {
    const response = await fetch(freesoundUrl);

    if (!response.ok) {
      // Retry on server errors (5xx) and gateway timeouts
      if (response.status >= 500 && retries > 0) {
        console.warn(`Freesound API returned status ${response.status}. Retrying...`);
        await new Promise((resolve) => setTimeout(resolve, 1500));
        return fetchFromFreesound(query, retries - 1);
      }

      const errorText = await response.text();
      if (response.status === 504 || /gateway\s*timeout/i.test(errorText)) {
        throw new Error(
          'Freesound timed out — their servers are slow or overloaded. Try again in a moment.',
        );
      }
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.detail) {
          const detail =
            typeof errorJson.detail === 'string'
              ? errorJson.detail
              : JSON.stringify(errorJson.detail);
          throw new Error(`Freesound: ${detail}`);
        }
      } catch (e) {
        if (e instanceof Error && e.message.startsWith('Freesound:')) throw e;
        const shortBody =
          errorText.length > 120 ? `${errorText.slice(0, 120)}…` : errorText;
        throw new Error(
          `Freesound request failed (${response.status} ${response.statusText}). ${shortBody}`,
        );
      }
      throw new Error(
        `Freesound request failed (${response.status} ${response.statusText}).`,
      );
    }
    const data = await response.json();

    const sounds = data.results
      .filter((sound: any) => sound.previews?.['preview-hq-mp3'])
      .map((sound: any) => ({
        id: sound.id,
        name: sound.name,
        previewUrl: sound.previews['preview-hq-mp3'],
      }));

    return sounds;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'An unknown error occurred';
    if (error instanceof Error && isOperationalFreesoundMessage(error.message)) {
      throw error;
    }
    console.error('Failed to fetch from Freesound API:', error);
    throw new Error(errorMessage);
  }
}


export async function searchFreesound(
  query: string
): Promise<FreesoundSound[] | {error: string}> {
  try {
    const data = await fetchFromFreesound(query);
    if (!data) {
        return { error: 'Failed to fetch from Freesound after retries.' };
    }
    return data;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'An unknown error occurred';
    if (
      !(error instanceof Error && isOperationalFreesoundMessage(error.message))
    ) {
      console.error('Error in searchFreesound:', error);
    }
    return { error: errorMessage };
  }
}
