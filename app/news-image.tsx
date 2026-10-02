"use client";
import { useState } from "react";

export default function NewsImage({ src, href, title }: { src: string; href: string; title: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  // Native lazy loading: arbitrary feed image hosts are never fetched by the
  // Next.js image optimizer. No feed HTML, scripts or referrer are forwarded.
  return <a className="news-image-link" href={href} target="_blank" rel="noopener noreferrer" aria-label={`${title} — cikk megnyitása`}>
    <img className="news-image" src={src} alt="" width={144} height={96} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
  </a>;
}
