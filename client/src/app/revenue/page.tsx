"use client";

import { RevenueDashboard } from "@/components/monetization/RevenueDashboard";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function RevenuePage() {
  return (
    <div className="min-h-screen bg-bg-base text-text-primary p-6 animate-in fade-in">
      <div className="max-w-5xl mx-auto space-y-6">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-text-secondary hover:text-accent transition-colors">
          <ArrowLeft size={20} />
          <span>Back to Dashboard</span>
        </Link>
        <div className="bg-bg-elevated border border-border-default rounded-2xl shadow-xl overflow-hidden">
             <RevenueDashboard />
        </div>
      </div>
    </div>
  );
}
