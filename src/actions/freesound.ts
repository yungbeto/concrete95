'use server';

const FREESOUND_API_URL = 'https://freesound.org/apiv2';

type FreesoundSound = {
  id: number;
  name: string;
  previews: {
    'preview-hq-mp3': string;
  };
};

type FreesoundResponse = {
  results: FreesoundSound[];
};

export async function getFreesoundSample(tags: string[]): Promise<string | null> {
  const apiKey = process.env.FREESOUND_API_KEY;
  if (!apiKey) {
    console.error('Freesound API key not found. Please add FREESOUND_API_KEY to your .env.local file.');
    return null;
  }

  if (tags.length === 0) {
    return null;
  }

  const query = tags.join(' ');

  try {
    const url = `${FREESOUND_API_URL}/search/text/?query=${encodeURIComponent(query)}&fields=id,name,previews&token=${apiKey}&filter=duration:[5 TO 90]`;
    const response = await fetch(url, { cache: 'no-store' });

    if (!response.ok) {
      console.error('Freesound API error:', response.status, await response.text());
      return null;
    }

    const data: FreesoundResponse = await response.json();

    if (data.results && data.results.length > 0) {
      const randomIndex = Math.floor(Math.random() * data.results.length);
      const randomSound = data.results[randomIndex];
      return randomSound.previews['preview-hq-mp3'];
    }

    return null;
  } catch (error) {
    console.error('Error fetching from Freesound:', error);
    return null;
  }
}
