// src/components/Footer.jsx — center-only cc line
import React from "react";

/**
 * Props
 * - brand?: string (defaults to env or "Blue Bash Investment Ltd")
 * - note?: string (override text if you want a fixed year/wording)
 */
export default function Footer({ brand, note }) {
  const YEAR = new Date().getFullYear();
  const BRAND =
    brand ||
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_BRAND_NAME) ||
    (typeof process !== "undefined" && process.env?.REACT_APP_BRAND_NAME) ||
    "Blue Bash Investment Ltd";

  const displayNote = note || `© ${YEAR} ${BRAND}. All rights reserved.`;

  return (
    <footer className="mt-0 border-t border-white/10 bg-slate-950/70 backdrop-blur-sm print:hidden">
      {/* top gradient hairline (optional but nice) */}
      <div className="h-0.5 w-full bg-gradient-to-r from-emerald-300 via-cyan-300 to-sky-400" />
      <div className="mx-auto max-w-7xl px-4 py-4">
        <p className="text-center text-[11px] text-white/70">
          {displayNote}
        </p>
      </div>
    </footer>
  );
}
