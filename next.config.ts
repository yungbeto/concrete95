
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'i.imgur.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'd2w9rnfcy7mm78.cloudfront.net',
        port: '',
        pathname: '/**',
      }
    ],
  },
  // Stop the Next.js dev server from watching the /src/ai directory.
  // The genkit CLI is watching this directory and will trigger a restart of the
  // Next.js dev server if it is also watching the same directory.
  turbo: {
    rules: {
      '**/src/ai/**': {
        // Only apply loaders, and don't watch for changes.
        loaders: {},
        as: 'asset',
      },
    },
  },
};

export default nextConfig;
