"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-bg-primary text-text-primary font-sans p-6 md:p-12">
       <div className="max-w-3xl mx-auto">
        <div className="mb-8">
            <Link href="/" className="inline-flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors">
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Home</span>
            </Link>
        </div>
        
        <h1 className="text-3xl md:text-4xl font-bold mb-8">Privacy Policy</h1>
        
        <div className="space-y-6 text-text-secondary leading-relaxed">
            <p><strong>Last Updated:</strong> December 2025</p>

            <section>
                <h2 className="text-xl font-semibold text-text-primary mb-3">1. Information We Collect</h2>
                <p>We collect information you provide directly (such as account details and story content) and usage data to improve InkVerse. Your story data is yours.</p>
            </section>

            <section>
                <h2 className="text-xl font-semibold text-text-primary mb-3">2. How We Use Information</h2>
                <p>We use your data to power the AI features, maintain the service, and communicate with you. We do not sell your personal story content to third parties.</p>
            </section>

            <section>
                <h2 className="text-xl font-semibold text-text-primary mb-3">3. AI & Content</h2>
                <p>Content you generate using our AI tools is processed by third-party providers (e.g., LLMs, Image Generators) solely for the purpose of fulfilling your requests.</p>
            </section>

            <section>
                <h2 className="text-xl font-semibold text-text-primary mb-3">4. Security</h2>
                <p>We implement industry-standard security measures to protect your account and creative works.</p>
            </section>


        </div>
       </div>
    </div>
  );
}
