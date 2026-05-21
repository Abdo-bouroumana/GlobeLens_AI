import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GlobeLens AI — News Intelligence Platform",
  description:
    "Advanced AI-powered news intelligence platform. Multi-source synthesis, bias detection, geo-tagged events, and real-time fact-checking.",
  keywords: ["news", "AI", "intelligence", "bias detection", "fact-check"],
  authors: [{ name: "GlobeLens AI Team" }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
