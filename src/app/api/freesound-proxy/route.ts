import {NextResponse} from 'next/server';

export async function GET(request: Request) {
  const {searchParams} = new URL(request.url);
  const query = searchParams.get('query');
  const apiKey = process.env.FREESOUND_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {error: 'Freesound API key is not configured.'},
      {status: 500}
    );
  }

  if (!query) {
    return NextResponse.json({error: 'Query parameter is required.'}, {status: 400});
  }

  // We are searching for sounds that are licensed under the Creative Commons 0 license, have a duration between 1 and 10 seconds,
  // and are of the highest quality. We are also sorting the results by the number of downloads.
  const freesoundUrl = `https://freesound.org/apiv2/search/text/?query=${encodeURIComponent(
    query
  )}&token=${apiKey}&filter=duration:[1%20TO%2015]%20license:"Creative%20Commons%200"&fields=id,name,previews,license,username,duration&sort=downloads_desc&page_size=5`;

  try {
    const response = await fetch(freesoundUrl);
    if (!response.ok) {
      throw new Error(`Freesound API error: ${response.statusText}`);
    }
    const data = await response.json();

    // We only need the preview URL
    const soundUrls = data.results.map((sound: any) => sound.previews['preview-hq-mp3']);

    return NextResponse.json(soundUrls);
  } catch (error) {
    console.error(error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({error: errorMessage}, {status: 500});
  }
}
