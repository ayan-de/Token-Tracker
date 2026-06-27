import type { Metadata } from "next";
import "./globals.css";
import RootErrorBoundary from "@/components/RootErrorBoundary";

export const metadata: Metadata = {
  title: "TokenTracker",
  description: "AI Provider Quota & Cost Monitor",
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
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600&family=Outfit:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <RootErrorBoundary>{children}</RootErrorBoundary>
      </body>
    </html>
  );
}