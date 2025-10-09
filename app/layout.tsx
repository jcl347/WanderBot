import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: {
    default: "Wanderbot",
    template: "%s · Wanderbot",
  },
  description:
    "Wanderbot plans your trips with smart fares, gorgeous photo collages, and maps tailored to your crew.",
  applicationName: "Wanderbot",
  openGraph: {
    title: "Wanderbot",
    description:
      "Plan smarter trips with airfare insights, curated images, and interactive maps.",
    url: "/",
    siteName: "Wanderbot",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Wanderbot",
    description:
      "Plan smarter trips with airfare insights, curated images, and interactive maps.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Speed up Wikimedia image fetches */}
        <link rel="preconnect" href="https://commons.wikimedia.org" />
        <link rel="preconnect" href="https://upload.wikimedia.org" />
        <link rel="dns-prefetch" href="https://commons.wikimedia.org" />
        <link rel="dns-prefetch" href="https://upload.wikimedia.org" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="flex h-screen bg-gray-200 w-full flex-col text-stone-900">
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
