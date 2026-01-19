"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, GitBranch, List, Network, Trash2, Edit2, X } from "lucide-react";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import { createApi } from "@/lib/api";
import { BranchModal } from "@/components/BranchModal";

type ViewMode = "timeline" | "tree";

interface Branch {
  id: string;
  name: string;
  baseChapterId: string | null;
  createdAt: string;
  baseChapter?: {
    id: string;
    title: string;
  };
}

interface Chapter {
  id: string;
  title: string;
  order: number;
  branchId: string | null;
}

export default function BranchesPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const supabase = useSupabase();
  const api = createApi(supabase);
  
  const [project, setProject] = useState<any>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("timeline");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editModal, setEditModal] = useState<{ branchId: string; currentName: string } | null>(null);

  useEffect(() => {
    loadData();
  }, [params.id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [projectData, branchesData, chaptersData] = await Promise.all([
        api.getProject(params.id),
        api.getBranches(params.id),
        api.listChaptersPaginated(params.id, 0, 1000, true) // Get all chapters (up to 1000), including branches
      ]);
      
      setProject(projectData);
      setBranches(branchesData);
      setChapters(chaptersData.items || []);
    } catch (e) {
      console.error("Failed to load data:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBranch = async (branchId: string) => {
    if (!confirm("Delete this branch? All chapters in this branch will be deleted.")) return;
    
    // Optimistic update: remove branch immediately
    setBranches(prev => prev.filter(b => b.id !== branchId));
    setChapters(prev => prev.filter(ch => ch.branchId !== branchId));
    
    try {
      await api.deleteBranch(branchId);
    } catch (e: any) {
      alert("Failed to delete branch: " + e.message);
      // Revert on error
      loadData();
    }
  };

  const openEditModal = (branchId: string, currentName: string) => {
    setEditModal({ branchId, currentName });
  };

  const handleEditBranch = async (newName: string) => {
    if (!editModal || !newName || newName === editModal.currentName) {
      setEditModal(null);
      return;
    }
    
    const { branchId } = editModal;
    
    // Optimistic update: update branch name immediately
    setBranches(prev => prev.map(b => 
      b.id === branchId ? { ...b, name: newName } : b
    ));
    setEditModal(null);
    
    try {
      await api.updateBranch(branchId, newName);
    } catch (e: any) {
      // Revert on error
      loadData();
    }
  };

  const handleBranchCreated = (newBranch: Branch) => {
    // Add new branch to the list immediately
    setBranches(prev => [...prev, newBranch]);
    setShowCreateModal(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="text-text-secondary">Loading branches...</div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-bg-primary text-text-primary p-4 overflow-y-auto">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/dashboard")}
              className="p-1.5 hover:bg-bg-hover rounded-full transition"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-bold">{project?.title} - Branches</h1>
              <p className="text-xs text-text-secondary">Manage story timelines and alternate paths</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* View Toggle */}
            <div className="bg-bg-elevated rounded-lg p-0.5 flex gap-0.5 border border-border-default">
              <button
                onClick={() => setViewMode("timeline")}
                className={`px-2 py-1 rounded text-xs font-medium transition flex items-center gap-1.5 ${
                  viewMode === "timeline"
                    ? "bg-accent text-black"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                <List size={14} />
                Timeline
              </button>
              <button
                onClick={() => setViewMode("tree")}
                className={`px-2 py-1 rounded text-xs font-medium transition flex items-center gap-1.5 ${
                  viewMode === "tree"
                    ? "bg-accent text-black"
                    : "text-text-secondary hover:text-primary"
                }`}
              >
                <Network size={14} />
                Tree
              </button>
            </div>

            <button
              onClick={() => setShowCreateModal(true)}
              className="px-3 py-1.5 bg-accent text-black rounded-lg text-sm font-semibold hover:bg-accent-hover transition flex items-center gap-1.5"
            >
              <Plus size={16} />
              New Branch
            </button>
          </div>
        </div>

        {/* Content */}
        {viewMode === "timeline" ? (
          <TimelineView
            projectId={params.id}
            branches={branches}
            chapters={chapters}
            onDeleteBranch={handleDeleteBranch}
            onEditBranch={openEditModal}
          />
        ) : (
          <TreeView
            projectId={params.id}
            branches={branches}
            chapters={chapters}
            onDeleteBranch={handleDeleteBranch}
            onEditBranch={openEditModal}
          />
        )}

        {/* Create Branch Modal */}
        <BranchModal
          projectId={params.id}
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleBranchCreated}
        />

        {/* Edit Branch Modal */}
        {editModal && (
          <EditBranchModal
            currentName={editModal.currentName}
            onClose={() => setEditModal(null)}
            onSave={handleEditBranch}
          />
        )}
      </div>
    </div>
  );
}

// Timeline View Component
function TimelineView({
  projectId,
  branches,
  chapters,
  onDeleteBranch,
  onEditBranch
}: {
  projectId: string;
  branches: Branch[];
  chapters: Chapter[];
  onDeleteBranch: (id: string) => void;
  onEditBranch: (id: string, currentName: string) => void;
}) {
  const mainChapters = chapters.filter(ch => !ch.branchId).sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-4">
      {/* Main Timeline */}
      <div className="bg-bg-elevated border border-border-default rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <GitBranch className="text-accent" size={18} />
            Main Timeline
          </h2>
          <span className="text-xs text-text-secondary">{mainChapters.length} chapters</span>
        </div>
        
        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
          {mainChapters.map((chapter, idx) => (
            <div
              key={chapter.id}
              className="flex items-center gap-2 p-2 bg-bg-base rounded border border-border-default transition"
            >
              <span className="text-xs font-mono text-text-tertiary w-6">{idx + 1}</span>
              <span className="flex-1 text-xs">{chapter.title}</span>
              {branches.filter(b => b.baseChapterId === chapter.id).length > 0 && (
                <span className="text-xs bg-accent/10 text-accent px-1.5 py-0.5 rounded">
                  {branches.filter(b => b.baseChapterId === chapter.id).length} branch(es)
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Branch Timelines */}
      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
      {branches.map(branch => {
        const branchChapters = chapters
          .filter(ch => ch.branchId === branch.id)
          .sort((a, b) => a.order - b.order);

        return (
          <div key={branch.id} className="bg-bg-elevated border border-border-default rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-base font-semibold flex items-center gap-2">
                  <GitBranch className="text-blue-400" size={16} />
                  <a href={`/project/${projectId}/branch/${branch.id}`} className="hover:underline hover:text-blue-400 transition">
                    {branch.name}
                  </a>
                </h2>
                {branch.baseChapter && (
                  <p className="text-xs text-text-tertiary">
                    Branches from: {branch.baseChapter.title}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-text-secondary">{branchChapters.length} chapters</span>
                <button
                  onClick={() => onEditBranch(branch.id, branch.name)}
                  className="p-1.5 text-text-secondary hover:bg-bg-hover rounded transition"
                  title="Edit branch name"
                >
                  <Edit2 size={14} />
                </button>
                <button
                  onClick={() => onDeleteBranch(branch.id)}
                  className="p-1.5 text-red-400 hover:bg-red-500/10 rounded transition"
                  title="Delete branch"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
              {branchChapters.length === 0 ? (
                <div className="text-center py-4 text-text-tertiary text-xs">
                  No chapters in this branch yet
                </div>
              ) : (
                branchChapters.map((chapter, idx) => (
                  <div
                    key={chapter.id}
                    className="flex items-center gap-2 p-2 bg-bg-base rounded border border-border-default transition"
                  >
                    <span className="text-xs font-mono text-text-tertiary w-6">{idx + 1}</span>
                    <span className="flex-1 text-xs">{chapter.title}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
      </div>

      {branches.length === 0 && (
        <div className="bg-bg-elevated border border-dashed border-border-default rounded-lg p-8 text-center">
          <GitBranch className="mx-auto mb-3 text-text-tertiary" size={36} />
          <h3 className="text-base font-semibold mb-1">No branches yet</h3>
          <p className="text-xs text-text-secondary">
            Create alternate timelines and explore different story paths
          </p>
        </div>
      )}
    </div>
  );
}

// Tree View Component (Visual Graph)
function TreeView({
  projectId,
  branches,
  chapters,
  onDeleteBranch,
  onEditBranch
}: {
  projectId: string;
  branches: Branch[];
  chapters: Chapter[];
  onDeleteBranch: (id: string) => void;
  onEditBranch: (id: string, currentName: string) => void;
}) {
  const mainChapters = chapters.filter(ch => !ch.branchId).sort((a, b) => a.order - b.order);

  return (
    <div className="bg-bg-elevated border border-border-default rounded-xl p-8">
      <div className="space-y-8">
        {/* Main Timeline Nodes */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">Main Timeline</h3>
          {mainChapters.map((chapter, idx) => {
            const branchesFromHere = branches.filter(b => b.baseChapterId === chapter.id);
            
            return (
              <div key={chapter.id} className="relative">
                {/* Main Chapter Node */}
                <div className="flex items-center gap-4">
                  <div className="w-64 p-4 bg-accent/10 border-2 border-accent rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-text-tertiary">{idx + 1}</span>
                      <span className="text-sm font-medium">{chapter.title}</span>
                    </div>
                  </div>

                  {/* Branch Indicators */}
                  {branchesFromHere.length > 0 && (
                    <div className="flex-1 flex items-center gap-4">
                      <div className="h-px w-8 bg-border-default"></div>
                      <div className="flex flex-wrap gap-3">
                        {branchesFromHere.map(branch => (
                          <div
                            key={branch.id}
                            className="group relative p-3 bg-blue-500/10 border-2 border-blue-400 rounded-lg hover:bg-blue-500/20 transition"
                          >
                            <div className="flex items-center gap-2">
                              <GitBranch size={14} className="text-blue-400" />
                              <a href={`/project/${projectId}/branch/${branch.id}`} className="text-sm font-medium hover:underline">
                                {branch.name}
                              </a>
                              <button
                                onClick={() => onEditBranch(branch.id, branch.name)}
                                className="opacity-0 group-hover:opacity-100 p-1 text-text-secondary hover:bg-bg-hover rounded transition"
                                title="Edit branch name"
                              >
                                <Edit2 size={12} />
                              </button>
                              <button
                                onClick={() => onDeleteBranch(branch.id)}
                                className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:bg-red-500/10 rounded transition"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                            <span className="text-xs text-text-tertiary mt-1 block">
                              {chapters.filter(ch => ch.branchId === branch.id).length} chapters
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Connector Line */}
                {idx < mainChapters.length - 1 && (
                  <div className="ml-32 w-px h-8 bg-border-default"></div>
                )}
              </div>
            );
          })}
        </div>

        {branches.length === 0 && mainChapters.length === 0 && (
          <div className="text-center py-12 text-text-tertiary">
            <Network className="mx-auto mb-4" size={48} />
            <p>No chapters or branches to display</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Edit Branch Modal Component
function EditBranchModal({
  currentName,
  onClose,
  onSave
}: {
  currentName: string;
  onClose: () => void;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    onSave(name.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in p-4">
      <div className="relative w-full max-w-sm bg-bg-elevated rounded-lg shadow-2xl border border-border-default p-5">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-text-tertiary hover:text-text-primary transition"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <Edit2 className="w-4 h-4 text-accent" />
          <h2 className="text-base font-bold text-text-primary">Edit Branch Name</h2>
        </div>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Branch name"
            className="w-full rounded-lg bg-bg-base border border-border-default px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent outline-none mb-4"
            autoFocus
            disabled={saving}
          />

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 rounded-lg border border-border-default px-3 py-2 text-sm text-text-secondary hover:bg-bg-hover transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim() || name === currentName}
              className="flex-1 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-black hover:bg-accent-hover transition disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
