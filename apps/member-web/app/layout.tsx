import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Melanated Adventurers",
  description: "Join the MA app waitlist and discover beginner-friendly experiences.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="siteHeader">
          <Link className="brand" href="/">MA</Link>
          <nav aria-label="Primary navigation">
            <Link href="/castaway">Castaway pilot</Link>
            <Link href="/operator">Operator preview</Link>
          </nav>
        </header>
        {children}
        <footer>
          <p>Melanated Adventurers · Jacksonville, Florida</p>
        </footer>
      </body>
    </html>
  );
}
