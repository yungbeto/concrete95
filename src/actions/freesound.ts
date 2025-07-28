'use server';

export type FreesoundSound = {
  id: number;
  name: string;
  previewUrl: string;
};

async function fetchFromFreesound(query: string) {
  const apiKey = process.env.FREESOUND_API_KEY;

  console.log('Attempting to fetch from Freesound...');

  if (!apiKey) {
    const errorMsg = 'Freesound API key is not configured.';
    console.error(errorMsg);
    throw new Error(errorMsg);
  } else {
    console.log('Freesound API key found.');
  }

  // We are searching for sounds that are licensed under the Creative Commons 0 license, have a duration between 1 and 15 seconds,
  // and are of the highest quality. We are also sorting the results by creation date to get more variety.
  // An empty query will return the latest sounds.
  const freesoundUrl = `https://freesound.org/apiv2/search/text/?query=${encodeURIComponent(
    query || ''
  )}&filter=duration:[1%20TO%2015]%20license:"Creative%20Commons%200"&fields=id,name,previews,license,username,duration&sort=created_desc&page_size=50`;

  try {
    console.log('Fetching from URL:', freesoundUrl);
    const response = await fetch(freesoundUrl, {
      headers: {
        Authorization: `Api-Key ${apiKey}`,
      },
    });

    console.log('Freesound API Response Status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Freesound API error response text:', errorText);
      throw new Error(`Freesound API error: ${response.statusText} - ${errorText}`);
    }
    const data = await response.json();

    // We only need the preview URL
    const sounds = data.results.map((sound: any) => ({
      id: sound.id,
      name: sound.name,
      previewUrl: sound.previews['preview-hq-mp3'],
    }));

    console.log(`Successfully fetched ${sounds.length} sounds.`);
    return sounds;
  } catch (error) {
    console.error('Failed to fetch from Freesound API (catch block):', error);
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
