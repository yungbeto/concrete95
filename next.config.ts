
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
    ],
  },
  // Stop the Next.js dev server from watching the /src/ai directory.
  // The genkit CLI is watching this directory and will trigger a restart of the
  // Next.js dev server if it is also watching the same directory.
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.watchOptions.ignored = ['**/src/ai/**'];
    }
    return config;
  },
};

export default nextConfig;
