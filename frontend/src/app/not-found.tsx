"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Home, ShieldAlert } from "lucide-react";

export default function NotFound() {
  const [timestamp, setTimestamp] = useState("");

  useEffect(() => {
    const now = new Date();
    // Format: YYYY-MM-DD.HHMM.SSZ
    const formatted = `${now.getUTCFullYear()}-${String(
      now.getUTCMonth() + 1
    ).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}.${String(
      now.getUTCHours()
    ).padStart(2, "0")}${String(now.getUTCMinutes()).padStart(2, "0")}.${String(
      now.getUTCSeconds()
    ).padStart(2, "0")}Z`;
    setTimestamp(formatted);
  }, []);

  return (
    <div className="bg-surface text-on-surface antialiased overflow-hidden min-h-screen flex flex-col selection:bg-primary-container selection:text-primary relative font-body-md">
      {/* Decorative Grid and Glow Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(69,70,77,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(69,70,77,0.06)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none z-0"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-radial-glow opacity-10 pointer-events-none z-0"></div>

      {/* Main Content Area */}
      <main className="flex-grow flex items-center justify-center p-margin-mobile relative z-10 w-full max-w-container-max-width mx-auto">
        {/* Dossier Card / Glass Panel */}
        <div className="glass-panel rounded-xl p-stack-lg max-w-2xl w-full flex flex-col md:flex-row gap-stack-lg items-center md:items-start relative overflow-hidden group hover:border-primary transition-colors duration-500">
          {/* Redaction Bar Accent Top */}
          <div className="absolute top-0 left-0 w-full h-1 bg-surface-variant flex">
            <div className="h-full bg-error w-1/4"></div>
            <div className="h-full bg-outline-variant w-1/2 ml-auto opacity-50"></div>
          </div>

          {/* Iconography Area */}
          <div className="flex-shrink-0 bg-surface-container-lowest p-stack-md rounded-lg border border-outline-variant shadow-[0_2px_0px_rgba(0,0,0,0.4)] flex items-center justify-center">
            <ShieldAlert className="w-14 h-14 text-on-surface-variant select-none" />
          </div>

          {/* Content Area */}
          <div className="flex-col w-full text-center md:text-left">
            <div className="glitch-wrapper mb-2">
              <h1 
                className="font-display-lg text-3xl md:text-4xl text-on-surface glitch-text font-bold" 
                data-text="Intelligence Gap (404)"
              >
                Intelligence Gap (404)
              </h1>
            </div>
            <p className="font-body-lg text-body-lg text-on-surface-variant mb-6 max-w-lg leading-relaxed">
              The intelligence dossier you are looking for has either been redacted, moved, or never existed.
            </p>

            {/* Local Search Form (Simulated Routing back to Home) */}
            <form action="/" className="w-full relative mb-6 group" method="GET">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="w-5 h-5 text-outline group-focus-within:text-primary transition-colors" />
              </div>
              <input
                name="q"
                type="text"
                aria-label="Search intelligence feed"
                className="w-full bg-surface border border-outline text-on-surface font-body-md rounded-lg pl-10 pr-4 py-3 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder-on-surface-variant/40 transition-all shadow-inner"
                placeholder="Search global intelligence feed..."
              />
              <div className="absolute bottom-0 left-0 h-[1px] bg-primary w-0 group-focus-within:w-full transition-all duration-300"></div>
            </form>

            {/* Action Button */}
            <div className="flex justify-center md:justify-start">
              <Link
                href="/"
                className="inline-flex items-center gap-2 bg-primary text-on-primary font-label-caps text-xs uppercase px-6 py-3 rounded border border-transparent hover:bg-primary-fixed-dim hover:shadow-[0_2px_0px_rgba(0,0,0,0.4)] transition-all active:scale-95 tracking-wide font-bold"
              >
                <Home className="w-4 h-4" />
                Return to Home Feed
              </Link>
            </div>

            {/* Terminal-esque metadata */}
            <div className="mt-8 border-t border-outline-variant/30 pt-3 flex justify-between items-center opacity-60">
              <span className="font-mono-data text-[10px] text-on-surface-variant">
                ERR_CODE: 404_REDACTED
              </span>
              <span className="font-mono-data text-[10px] text-on-surface-variant tracking-widest">
                TS: <span>{timestamp}</span>
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
