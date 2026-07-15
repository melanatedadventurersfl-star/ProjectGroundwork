import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Melanated Adventurers App",
  description: "Join early access for the Melanated Adventurers app.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
