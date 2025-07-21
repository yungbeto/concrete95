
import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import AnalyticsProvider from '@/components/AnalyticsProvider';

const siteUrl = 'https://concrete95.net';
const ogImageUrl = `${siteUrl}/og-image.png`;

export const metadata: Metadata = {
  title: 'Ethereal Acoustics',
  description: 'An experimental audio environment.',
  metadataBase: new URL(siteUrl),
  openGraph: {
    type: 'website',
    url: siteUrl,
    title: 'Ethereal Acoustics',
    description: 'An experimental audio environment. Sounds from Freesound.org.',
    images: [
      {
        url: ogImageUrl,
        width: 1200,
        height: 630,
        alt: 'Ethereal Acoustics - An experimental audio environment.',
      },
    ],
    siteName: 'Ethereal Acoustics',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ethereal Acoustics',
    description: 'An experimental audio environment. Sounds from Freesound.org.',
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
        <link href="https://fonts.googleapis.com/css2?family=Inter&display=swap" rel="stylesheet" />
        <link href="https://fonts.cdnfonts.com/css/pixel-lcd7" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
