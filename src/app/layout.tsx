import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  title: 'Concrete 95',
  description: 'AI-Driven Generative Soundscapes. Create unique, evolving audio environments with a retro-inspired interface.',
  metadataBase: new URL(siteUrl),
  openGraph: {
    type: 'website',
    url: siteUrl,
    title: 'Concrete 95',
    description: 'AI-Driven Generative Soundscapes. Create unique, evolving audio environments with a retro-inspired interface.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Concrete 95 - AI-Driven Generative Soundscapes',
      },
    ],
    siteName: 'Concrete 95',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Concrete 95',
    description: 'AI-Driven Generative Soundscapes. Create unique, evolving audio environments with a retro-inspired interface.',
    images: ['/og-image.png'],
  },
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
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
