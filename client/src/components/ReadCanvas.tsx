"use client";

import { memo } from "react";

type Project = {
  id: string;
  title: string;
  chaptersCount?: number;
};

export default function ReadCanvas({
  loading,
  projects,
  onOpenChapter,
  onEmptyCreate,
}: {
  loading: boolean;
  projects: Project[];
  onOpenChapter: (id: string) => void;
  onEmptyCreate?: () => void;
}) {
  if (loading) return <div className="text-slate-400 text-sm">Loading…</div>;

  if (!projects || projects.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="text-sky-200 text-lg tracking-wide mb-2">No tales etched yet.</div>
          <div className="text-slate-400">Return to CREATE.</div>
          {onEmptyCreate && (
            <button onClick={onEmptyCreate} className="mt-4 rounded bg-cyan-400/90 hover:bg-cyan-300 text-black px-4 py-2 font-semibold">
              AWAKEN NEW GATE
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {projects.map((p) => (
        <Accordion key={p.id} title={`${p.title} ${formatChapters(p.chaptersCount)}`}>
          <ul className="grid gap-1">
            <li>
              <button onClick={() => onOpenChapter(p.id)} className="text-left px-2 py-1 rounded hover:bg-white/5">Chapter 1: Awakening</button>
            </li>
            <li>
              <button onClick={() => onOpenChapter(p.id)} className="text-left px-2 py-1 rounded hover:bg-white/5">Chapter 2: The Knife in the Dark</button>
            </li>
          </ul>
        </Accordion>
      ))}
    </div>
  );
}

function formatChapters(n?: number) {
  if (!n) return "[2 Chapters]";
  return `[${n} Chapters]`;
}

const Accordion = memo(function Accordion({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-slate-800 bg-slate-900/50">
      <details>
        <summary className="cursor-pointer select-none p-3 font-medium text-slate-200/90 hover:text-cyan-300">{title}</summary>
        <div className="p-3 text-sm">{children}</div>
      </details>
    </div>
  );
});
