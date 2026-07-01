import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Milk & Honey Wigs — Production Portal',
  description: 'Internal and supplier-facing production management portal.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU">
      <body>{children}</body>
    </html>
  );
}
