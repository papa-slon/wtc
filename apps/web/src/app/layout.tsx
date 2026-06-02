import '@wtc/ui/theme.css';
import './globals.css';
import type { ReactNode } from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'WTC Ecosystem — World Trader Club',
  description: 'Premium account & product hub for the WTC ecosystem: Axioma terminal, trading bots, TradingView access, education, and billing.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="wtc-appbg">{children}</div>
      </body>
    </html>
  );
}
