import type { Metadata } from "next";
import { AuthProvider } from "@/lib/auth";
import "@/globals.css";

export const metadata: Metadata = {
  title: "SEO & GEO Optimizer - Optimize for AI Search Engines",
  description:
    "Analyze and optimize your content for both traditional search engines and AI-powered search like ChatGPT, Perplexity, and Google SGE. Get actionable recommendations to improve your visibility.",
  keywords: [
    "SEO",
    "GEO",
    "AI search optimization",
    "search engine optimization",
    "generative engine optimization",
    "ChatGPT SEO",
    "Perplexity optimization",
  ],
  openGraph: {
    title: "SEO & GEO Optimizer",
    description: "Optimize your content for AI-powered search engines",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-white font-sans">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
