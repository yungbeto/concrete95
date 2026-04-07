'use client';

export default function AboutConcrete95Body() {
  return (
    <div className='text-black space-y-2 text-sm'>
      <p>
        Welcome to <span className='font-bold'>Concrete 95</span>, a tool for
        random audio explorations inspired by{' '}
        <a
          href='https://en.wikipedia.org/wiki/Musique_concr%C3%A8te'
          target='_blank'
          rel='noopener noreferrer'
          className='cursor-pointer text-blue-800 underline hover:text-blue-700'
        >
          Musique concrète
        </a>
        . All audio from Freesound.org and Tone.js.
      </p>
      <p>
        This app was built by{' '}
        <a
          href='http://robysaavedra.com'
          target='_blank'
          rel='noopener noreferrer'
          className='cursor-pointer text-blue-800 underline hover:text-blue-700'
        >
          Roby Saavedra
        </a>
        .
      </p>
      <p>Last updated: April 6, 2026</p>
    </div>
  );
}
