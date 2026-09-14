import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

const mobileInputStyles = `
  html {
    -webkit-text-size-adjust: 100%;
  }

  @media screen and (max-width: 900px) {
    input,
    textarea,
    select,
    [contenteditable="true"] {
      font-size: 16px !important;
    }
  }
`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: mobileInputStyles }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
