"use client";

import { useState, useEffect } from "react";
import { X, GitBranch } from "lucide-react";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import { createApi } from "@/lib/api";

interface BranchModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (branch: any) => void;
}

export function BranchModal({ projectId, isOpen, onClose, onSuccess }: BranchModalProps) {
  const supabase = useSupabase();
  const api = createApi(supabase);
  
  const [branchName, setBranchName] = useState("");
  const [baseChapterId, setBaseChapterId] = useState<string>("");
  const [chapters, setChapters] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (isOpen && projectId) {
      loadChapters();
    }
  }, [isOpen, projectId]);

  const loadChapters = async () => {
    try {
      setLoading(true);
      const data = await api.getProject(projectId);
      // Get chapters from the main timeline (branchId = null)
      const mainChapters = (data.chapters || []).filter((ch: any) => !ch.branchId);
      setChapters(mainChapters);
    } catch (e) {
      console.error("Failed to load chapters:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!branchName.trim()) {
      alert("Please enter a branch name");
      return;
    }

    try {
      setCreating(true);
      const newBranch = await api.createBranch(projectId, {
        name: branchName,
        baseChapterId: baseChapterId || undefined
      });
      
      setBranchName("");
      setBaseChapterId("");
      onSuccess?.(newBranch);
      onClose();
    } catch (e: any) {
      console.error("Failed to create branch:", e);
      alert("Failed to create branch: " + (e.message || "Unknown error"));
    } finally {
      setCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in p-4">
      <div className="relative w-full max-w-md bg-bg-elevated rounded-xl shadow-2xl border border-border-default p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-text-tertiary hover:text-text-primary transition"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-accent/10 rounded-lg">
            <GitBranch className="w-5 h-5 text-accent" />
          </div>
          <h2 className="text-xl font-bold text-text-primary">Create Story Branch</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Branch Name *
            </label>
            <input
              type="text"
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              placeholder="e.g., Evil Route, Alternate Ending"
              className="w-full rounded-lg bg-bg-primary border border-border-default px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent outline-none"
              disabled={creating}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Branch From (Optional)
            </label>
            <select
              value={baseChapterId}
              onChange={(e) => setBaseChapterId(e.target.value)}
              className="w-full rounded-lg bg-bg-primary border border-border-default px-3 py-2 text-sm text-text-primary focus:border-accent outline-none"
              disabled={creating || loading}
            >
              <option value="">Start from beginning</option>
              {chapters.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  {ch.title}
                </option>
              ))}
            </select>
            <p className="text-xs text-text-tertiary mt-1">
              Select a chapter where this timeline diverges from the main story
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              disabled={creating}
              className="flex-1 rounded-lg border border-border-default px-4 py-2 text-sm text-text-secondary hover:bg-bg-hover transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || !branchName.trim()}
              className="flex-1 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-black hover:bg-accent-hover transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {creating ? "Creating..." : "Create Branch"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
