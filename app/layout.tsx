import "./globals.css";

export const metadata = {
  title: "Melanated Adventurers Early Access",
  description: "Join the Melanated Adventurers app early-access list.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
