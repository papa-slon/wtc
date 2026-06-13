import '@wtc/ui/theme.css';
import './globals.css';
import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';

// Self-hosted via next/font (no external <link>, no layout shift). Each font is
// exposed as its own private CSS variable; theme.css then composes the public
// design tokens --font-sans / --font-mono from these (with system fallbacks):
//   --font-inter     -> Inter        (body / UI text)
//   --font-jetbrains -> JetBrains Mono (every numeric figure: .tov-mono/.tset-mono/.wtc-mono)
// This matches the bot_tortila journal "gold standard" identity (Inter UI + JetBrains Mono numbers).
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jetbrains',
});

export const metadata: Metadata = {
  title: 'WTC Ecosystem — World Trader Club',
  description: 'Premium account & product hub for the WTC ecosystem: Axioma terminal, trading bots, TradingView access, education, and billing.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetBrainsMono.variable}`}>
      <body>
        <div className="wtc-appbg">{children}</div>
      </body>
    </html>
  );
}
