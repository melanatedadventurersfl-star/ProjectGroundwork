import "./globals.css";

export const metadata = {
  title: "Melanated Adventurers Early Access",
  description: "Join the early-access interest list for the Melanated Adventurers member app.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
