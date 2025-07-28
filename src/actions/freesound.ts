'use server';

export type FreesoundSound = {
  id: number;
  name: string;
  previewUrl: string;
};

async function fetchFromFreesound(query: string) {
  const apiKey = process.env.FREESOUND_API_KEY;

  if (!apiKey) {
    throw new Error('Freesound API key is not configured.');
  }

  // We are searching for sounds that are licensed under the Creative Commons 0 license, have a duration between 1 and 15 seconds,
  // and are of the highest quality. We are also sorting the results by creation date to get more variety.
  // An empty query will return the latest sounds.
  const freesoundUrl = `https://freesound.org/apiv2/search/text/?query=${encodeURIComponent(
    query || ''
  )}&filter=duration:[1%20TO%2015]%20license:"Creative%20Commons%200"&fields=id,name,previews&sort=created_desc&page_size=50`;

  try {
    const response = await fetch(freesoundUrl, {
      headers: {
        Authorization: `Api-Key ${apiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Freesound API error: ${response.statusText} - ${errorText}`);
    }
    const data = await response.json();

    // We only need the preview URL
    const sounds = data.results.map((sound: any) => ({
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
    return data;
  } catch (error) {
    console.error('Error in searchFreesound:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return {error: errorMessage};
  }
}
