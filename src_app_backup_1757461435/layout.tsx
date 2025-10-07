import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "BizSproutAI — Validate your idea, launch with confidence",
  description:
    "Validate your business idea in minutes. Get a GO/REVIEW/NO-GO call plus the assets to launch when it’s a GO.",
  openGraph: {
    title: "BizSproutAI — Validate your idea, launch with confidence",
    description:
      "Score your idea across demand, urgency, moat, distribution, and economics.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Google Fonts for Inter + General Sans */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=General+Sans:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
