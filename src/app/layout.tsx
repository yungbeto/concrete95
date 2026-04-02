
import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import AnalyticsProvider from '@/components/AnalyticsProvider';

const siteUrl = 'https://concrete95.net';
const ogImageUrl = `${siteUrl}/og-image.png`;

export const metadata: Metadata = {
  title: 'Concrete 95',
  description: 'An experimental audio environment.',
  metadataBase: new URL(siteUrl),
  openGraph: {
    type: 'website',
    url: siteUrl,
    title: 'Concrete 95',
    description: 'An experimental audio environment. Sounds from Freesound.org and Tone.js.',
    images: [
      {
        url: ogImageUrl,
        width: 1200,
        height: 630,
        alt: 'Concrete 95 - An experimental audio environment.',
      },
    ],
    siteName: 'Concrete 95',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Concrete 95',
    description: 'An experimental audio environment. Sounds from Freesound.org and Tone.js.',
    images: [ogImageUrl],
  },
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <AnalyticsProvider />
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=VT323&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
