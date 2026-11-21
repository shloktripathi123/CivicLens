import { MainNav } from "../components/MainNav";
import "./globals.css";
import type { ReactNode } from "react";
import { Newsreader, Public_Sans } from "next/font/google";

const serif = Newsreader({ subsets: ["latin"], variable: "--font-serif", display: "swap", axes: ["opsz"] });
const sans = Public_Sans({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata = {
  title: "Civic Lens — find any public official",
  description: "Search officials, candidates and places: background, committees, races and sources.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <body>
        <a className="skip" href="#main">Skip to content</a>
        <header className="site">
          <div className="bar">
            <a href="/" className="brand">Civic Lens</a>
            <span className="tagline">Public records, with sources</span>
          </div>
        </header>
        <MainNav />
        <main id="main">{children}</main>
        <footer className="site">
          <p>Nonpartisan, source-cited public records. Every fact links to its source and carries a credibility grade.</p>
          <p>Data: unitedstates/congress-legislators (CC0), FEC, U.S. Census Bureau, Oregon Legislature.</p>
        </footer>
      </body>
    </html>
  );
}
