export const metadata = {
  title: "GoMelanated Next.js Test",
  description: "Minimal Next.js deployment test for Hostinger",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "Arial, sans-serif", margin: 0 }}>{children}</body>
    </html>
  );
}
