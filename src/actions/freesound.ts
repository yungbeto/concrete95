
'use server';

export type FreesoundSound = {
  id: number;
  name: string;
  previewUrl: string;
};

async function fetchFromFreesound(query: string, retries = 1) {
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
       // Retry on server errors (5xx)
      if (response.status >= 500 && retries > 0) {
        console.warn(`Freesound API returned status ${response.status}. Retrying...`);
        await new Promise(resolve => setTimeout(resolve, 1000)); // wait 1 second
        return fetchFromFreesound(query, retries - 1);
      }
      
      const errorText = await response.text();
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.detail) {
          throw new Error(`Freesound API error: ${errorJson.detail}`);
        }
      } catch (e) {
        throw new Error(`Freesound API error: ${response.statusText} - ${errorText}`);
      }
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
    console.error('Failed to fetch from Freesound API:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
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
    console.error('Error in searchFreesound:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return {error: errorMessage};
  }
}
