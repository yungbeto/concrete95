// /src/app/api/freesound-proxy/route.ts
import { type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const audioUrl = searchParams.get('url');

  if (!audioUrl) {
    return new Response('Audio URL is required', { status: 400 });
  }

  try {
    const apiKey = process.env.FREESOUND_API_KEY;
    if (!apiKey) {
      throw new Error('Freesound API key not configured');
    }

    // Fetch the audio file from Freesound using the API key for authorization
    const audioResponse = await fetch(audioUrl, {
      headers: {
        'Authorization': `Api-Key ${apiKey}`
      }
    });

    if (!audioResponse.ok) {
      const errorText = await audioResponse.text();
      console.error(`Freesound API error (${audioResponse.status}): ${errorText}`);
      return new Response(`Failed to fetch audio from Freesound: ${errorText}`, { status: audioResponse.status });
    }

    // Stream the audio data back to the client
    const headers = new Headers({
      'Content-Type': audioResponse.headers.get('Content-Type') || 'audio/mpeg',
      'Content-Length': audioResponse.headers.get('Content-Length') || '',
    });

    return new Response(audioResponse.body, { headers });

  } catch (error) {
    console.error('Error in Freesound proxy:', error);
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(message, { status: 500 });
  }
}
