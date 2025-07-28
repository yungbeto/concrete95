
'use server';

export type FreesoundSound = {
  id: number;
  name: string;
  previewUrl: string;
};

async function fetchFromFreesound(query: string) {
  const apiKey = process.env.FREESOUND_API_KEY;

  if (!apiKey) {
    throw new Error('Freesound API key is not configured. Please check your environment variables.');
  }

  // Freesound API requires the API key to be passed as a 'token' query parameter.
  const freesoundUrl = `https://freesound.org/apiv2/search/text/?query=${encodeURIComponent(
    query || ''
  )}&filter=duration:[1%20TO%2015]%20license:"Creative%20Commons%200"&fields=id,name,previews&sort=created_desc&page_size=50&token=${apiKey}`;

  try {
    // The request does not need an Authorization header when using the token parameter.
    const response = await fetch(freesoundUrl);

    if (!response.ok) {
      const errorText = await response.text();
      // Attempt to parse the error for a more specific message.
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.detail) {
          throw new Error(`Freesound API error: ${errorJson.detail}`);
        }
      } catch (e) {
        // Fallback to raw text if JSON parsing fails.
        throw new Error(`Freesound API error: ${response.statusText} - ${errorText}`);
      }
    }
    const data = await response.json();

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
