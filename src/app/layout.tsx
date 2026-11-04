import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { OfflineBanner } from "@/components/pwa/offline-banner";
import { config } from "@/config";

const instrumentSans = localFont({
  src: "./fonts/instrument-sans-latin.woff2",
  variable: "--font-instrument",
  weight: "400 700",
  display: "swap",
});

const siteUrl = config.app.origin;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Task Dispatcher — Field Service Dispatch Software",
    template: "%s · Task Dispatcher",
  },
  description:
    "Dispatch field tasks, track taskers live with GPS, and capture proof of work with photos — all in one mobile-first field service app.",
  applicationName: "Task Dispatcher",
  keywords: [
    "field service dispatch software",
    "field service management software",
    "job dispatch app",
    "work order management app",
    "field worker app",
    "dispatch software for field teams",
    "live location tracking for workers",
    "proof of work photo app",
    "task management app for field workers",
    "technician scheduling and dispatch",
  ],
  authors: [{ name: "Task Dispatcher" }],
  creator: "Task Dispatcher",
  publisher: "Task Dispatcher",
  category: "Business",
  classification: "Field Service Management",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Tasks",
  },
  formatDetection: { telephone: true },
  icons: {
    icon: "/icons/icon.svg",
    apple: "/icons/icon-192.png",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Task Dispatcher",
    title: "Task Dispatcher — Field Service Dispatch Software",
    description:
      "Dispatch field tasks, track taskers live with GPS, and capture proof of work with photos — all in one mobile-first field service app.",
    locale: "en_US",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Task Dispatcher — field service dispatch software",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Task Dispatcher — Field Service Dispatch Software",
    description:
      "Dispatch field tasks, track taskers live with GPS, and capture proof of work with photos.",
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  alternates: {
    canonical: "/",
  },
  verification: {
    // Placeholders; replace with real tokens when registering in search consoles.
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
    other: {
      "msvalidate.01": process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION ?? "",
    },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0d5f4c",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={instrumentSans.variable}>
      <body className="min-h-dvh">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          Skip to content
        </a>
        {children}
        <OfflineBanner />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
