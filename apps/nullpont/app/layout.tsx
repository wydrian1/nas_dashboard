import type { Metadata } from 'next';
import './style.css';
export const metadata: Metadata = { title: 'NULLPONT', description: 'Egy történet, amely még nem emlékszik rád.', robots: { index: false, follow: false } };
export default function Layout({ children }: { children: React.ReactNode }) { return <html lang="hu"><body>{children}</body></html>; }
