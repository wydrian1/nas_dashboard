import type { Metadata } from "next";
import "./globals.css";
import "./system.css";
import "./rss.css";
import "./personal.css";
import "./pokemon.css";
import "./navigation.css";
import "./brand.css";
import './version.css';

export const metadata: Metadata = {
  title: "Wydrian · Dashboard",
  description: "Személyes szolgáltatásközpont és hírolvasó",
  robots: { index: false, follow: false },
  icons: { icon: {url:'/brand-w-modules.svg',type:'image/svg+xml'},shortcut:'/brand-w-modules.svg' }
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="hu"><body>{children}</body></html>;
}
