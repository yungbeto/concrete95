'use server';

const FREESOUND_API_URL = 'https://freesound.org/apiv2';

type FreesoundSound = {
  id: number;
  name: string;
  duration: number;
  previews: {
    'preview-hq-mp3': string;
  };
};

type FreesoundResponse = {
  results: FreesoundSound[];
};

async function fetchSample(query: string, apiKey: string): Promise<{ url: string; duration: number } | null> {
  try {
    const url = `${FREESOUND_API_URL}/search/text/?query=${encodeURIComponent(
      query
    )}&fields=id,name,previews,duration&token=${apiKey}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Api-Key ${apiKey}`,
      },
    });

    if (!response.ok) {
      console.error('Freesound API error:', response.status, await response.text());
      return null;
    }

    const data: FreesoundResponse = await response.json();

    if (data.results && data.results.length > 0) {
      const randomIndex = Math.floor(Math.random() * data.results.length);
      const randomSound = data.results[randomIndex];
      return {
        url: randomSound.previews['preview-hq-mp3'],
        duration: randomSound.duration,
      };
    }

    return null;
  } catch (error) {
    console.error(`Error fetching from Freesound with query "${query}":`, error);
    return null;
  }
}

export async function getFreesoundSample(tags: string[]): Promise<{ url: string; duration: number } | null> {
  const apiKey = process.env.FREESOUND_API_KEY;
  if (!apiKey || apiKey === 'YOUR_FREESOUND_API_KEY_HERE') {
    console.error('Freesound API key not found. Please add FREESOUND_API_KEY to your .env.local file.');
    return null;
  }

  // First, try with the specific tags from the AI
  if (tags.length > 0) {
    const query = tags.join(' ');
    const result = await fetchSample(query, apiKey);
    if (result) {
      return result;
    }
    console.log(`No results for "${query}", trying fallback.`);
  }

  // If no tags provided or if the initial query failed, use a fallback query
  const fallbackQuery = 'field recording';
  return await fetchSample(fallbackQuery, apiKey);
}
