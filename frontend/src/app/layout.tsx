import type { Metadata } from "next";
import { Bitter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";


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
  title: "Librarian — RAG + Agentic AI",
  description: "Research your documents with hybrid search, query decomposition, and source-cited answers.",
};

function Nav() {
  return (
    <header className="border-b border-slate-800/80 px-5 py-3 flex items-center justify-between bg-slate-900/95 backdrop-blur-sm sticky top-0 z-50">
      <Link href="/" className="flex items-center gap-2 group">
        <span className="text-amber-400 text-lg">◈</span>
        <span className="font-serif text-[15px] font-medium tracking-tight text-slate-100">
          Librarian
        </span>
      </Link>

      <nav className="flex items-center gap-5 text-xs font-mono">
        <Link
          href="/upload"
          className="text-slate-500 hover:text-amber-400 transition-colors"
        >
          Upload
        </Link>
        <Link
          href="/chat"
          className="text-slate-500 hover:text-amber-400 transition-colors"
        >
          Chat
        </Link>
      </nav>
    </header>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${bitter.variable} ${ibmPlexMono.variable}`}>
      <body className="bg-slate-900 text-slate-200 min-h-screen antialiased">
        <Nav />
        {children}
      </body>
    </html>
  );
}
