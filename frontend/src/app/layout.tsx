import type { Metadata } from "next";
import { Bitter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { BookOpen } from "lucide-react";

const bitter = Bitter({
  subsets: ["latin"],
  variable: "--font-bitter",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Librarian — Local RAG",
  description: "Chat with your documents using a fully local RAG pipeline.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${bitter.variable} ${ibmPlexMono.variable}`}>
      <body className="bg-slate-900 text-slate-200 min-h-screen antialiased">

        {/* Nav */}
        <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <BookOpen className="w-5 h-5 text-amber-400 group-hover:text-amber-300 transition-colors" />
            <span className="font-serif text-lg tracking-tight text-slate-100">
              Librarian
            </span>
          </Link>

          <nav className="flex items-center gap-6 text-sm font-mono">
            <Link
              href="/upload"
              className="text-slate-400 hover:text-amber-400 transition-colors"
            >
              Upload
            </Link>
            <Link
              href="/chat"
              className="text-slate-400 hover:text-amber-400 transition-colors"
            >
              Chat
            </Link>
          </nav>
        </header>

        <main className="max-w-4xl mx-auto px-6 py-10">
          {children}
        </main>

      </body>
    </html>
  );
}
