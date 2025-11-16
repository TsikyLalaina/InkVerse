"use client";

import Link from "next/link";

export default function Investor() {
  return (
    <section className="relative w-full py-16 md:py-24 bg-gradient-to-b from-[#0B0B12] to-[#0A0A0A]">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-semibold text-white">
            BACK THE NEXT WEBTOON EMPIRE
          </h2>
          <p className="mt-3 text-slate-400 max-w-3xl mx-auto">
            We’re raising our seed round. InkVerse is building the AI‑powered webtoon studio—
            from story beats to finished episodes, with creators at the center.
          </p>
        </div>

        {/* Stats */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Stat title="Round" value="Seed (Open)" caption="Actively raising now" />
          <Stat title="Creators" value="Private beta" caption="Looking for design partners" />
          <Stat title="Stage" value="Pre‑launch" caption="Sharing traction post‑release" />
        </div>

        {/* Body */}
        <div className="mt-10 grid gap-8 md:grid-cols-2">
          <div className="space-y-3 text-slate-300 text-sm">
            <p className="text-slate-200">
              InkVerse compresses the webtoon pipeline with AI assistance:
              outlining, prose, panel thumbnails, and publication.
            </p>
            <ul className="space-y-2 list-disc list-inside">
              <li>Writing → Panels → Publishing in one workspace</li>
              <li>Creator‑first UX with memory of characters and rules</li>
              <li>Extensible image generation via partners</li>
            </ul>
          </div>
          <div className="space-y-3 text-slate-300 text-sm">
            <p className="text-slate-200">Partnerships (in progress): Fal.ai, Groq, Supabase</p>
            <p>TAM: Growing digital comics market with rapid mobile adoption</p>
            <p>Use of funds (target): scale AI, hire artists, launch InkVerse Studio</p>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/deck"
            className="rounded-lg border border-cyan-400/60 bg-cyan-400/10 px-5 py-3 text-cyan-200 hover:bg-cyan-400/20 shadow-[0_0_20px_rgba(0,212,255,0.35)]"
          >
            PITCH DECK
          </Link>
          <Link
            href="mailto:invest@inkverse.app"
            className="rounded-lg bg-cyan-400 px-5 py-3 font-semibold text-black hover:bg-cyan-300 shadow-[0_0_20px_rgba(0,212,255,0.45)]"
          >
            CONTACT INVESTORS
          </Link>
        </div>
      </div>
    </section>
  );
}

function Stat({ title, value, caption }: { title: string; value: string; caption: string }) {
  return (
    <div className="rounded-xl border border-cyan-400/50 bg-black/30 p-5 text-center shadow-[0_0_20px_rgba(0,212,255,0.25)]">
      <div className="text-2xl md:text-3xl font-semibold text-white">{value}</div>
      <div className="text-sm text-slate-300 mt-1">{title}</div>
      <div className="text-xs text-slate-500 mt-1">{caption}</div>
    </div>
  );
}
