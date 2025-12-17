"use client";

import { useEffect, useRef, useState } from "react";
import type { ComponentType } from "react";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import { useTheme } from "@/components/providers/ThemeProvider";
import { createApi } from "@/lib/api";
import { X, Check, AlertCircle, Upload } from "lucide-react";
import "@theme-toggles/react/css/Classic.css";
import { Classic } from "@theme-toggles/react";

const TTClassic = Classic as unknown as ComponentType<any>;

type ProfileTab = "profile" | "account";

export function ProfileSettingsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const supabase = useSupabase();
  const { setTheme: setGlobalTheme, isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<ProfileTab>("profile");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const usernameCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Load current user profile on mount
  useEffect(() => {
    if (!isOpen) return;
    loadProfile();
  }, [isOpen]);

  const loadProfile = async () => {
    setProfileLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setEmail(user.email || "");
      }

      // Fetch profile from backend
      const api = createApi(supabase);
      const profile = await api.get("/api/user/profile");
      const loadedUsername = profile.username || "";
      
      setUsername(loadedUsername);
      setProfilePhoto(profile.profilePhoto || null);
      // Resolve theme: only 'light' | 'dark'. If server sends other value, fallback to OS or light
      const serverTheme = profile.theme;
      const resolvedTheme: "light" | "dark" = serverTheme === "dark" ? "dark" : serverTheme === "light" ? "light" : (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      setTheme(resolvedTheme);
      setGlobalTheme(resolvedTheme);
      // Reset availability state when loading existing username
      setUsernameAvailable(null);
      setError(null);
      
      return loadedUsername;
    } catch (err) {
      console.error("Failed to load profile:", err);
      setError("Failed to load profile");
      return "";
    } finally {
      setProfileLoading(false);
    }
  };

  // Validate username format
  const validateUsernameFormat = (value: string): string | null => {
    const trimmed = value.trim();
    
    // Empty check
    if (!trimmed) {
      return null; // No error message for empty, just null state
    }
    
    // Length check
    if (trimmed.length < 3) {
      return "Username must be at least 3 characters";
    }
    if (trimmed.length > 20) {
      return "Username must be at most 20 characters";
    }
    
    // Format check
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
      return "Username can only contain letters, numbers, underscores, and hyphens";
    }
    
    // No leading/trailing special characters
    if (/^[-_]/.test(trimmed) || /[-_]$/.test(trimmed)) {
      return "Username cannot start or end with underscore or hyphen";
    }
    
    // No consecutive special characters
    if (/[-_]{2,}/.test(trimmed)) {
      return "Username cannot have consecutive underscores or hyphens";
    }
    
    return null; // Valid format
  };

  // Debounced username availability check
  const checkUsernameAvailability = async (value: string) => {
    if (usernameCheckTimer.current) clearTimeout(usernameCheckTimer.current);

    const trimmed = value.trim();
    
    // Check format first
    const formatError = validateUsernameFormat(trimmed);
    if (formatError) {
      setUsernameAvailable(null);
      setError(formatError);
      return;
    }

    // If empty or same as current, don't check
    if (!trimmed || trimmed === username) {
      setUsernameAvailable(null);
      setError(null);
      return;
    }

    setCheckingUsername(true);
    usernameCheckTimer.current = setTimeout(async () => {
      try {
        const api = createApi(supabase);
        const result = await api.post("/api/user/check-username", { username: trimmed });
        setUsernameAvailable(result.available);
        // Clear any previous errors when checking username
        if (result.available) {
          setError(null);
        } else {
          setError("This username is already taken");
        }
      } catch (err: any) {
        // Don't mark as unavailable on error - let the user know there's an issue
        console.error("Username check error:", err);
        setUsernameAvailable(null);
        setError(err?.message || "Failed to check username availability");
      } finally {
        setCheckingUsername(false);
      }
    }, 500);
  };

  const handleUsernameChange = (value: string) => {
    setUsername(value);
    checkUsernameAvailability(value);
  };

  const handlePhotoUpload = async (file: File) => {
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be less than 5MB");
      return;
    }

    try {
      setUploadingPhoto(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError("User not authenticated");
        return;
      }

      // Get bucket name from env or use default
      const bucketName = process.env.NEXT_PUBLIC_SUPABASE_USER_PROFILE || "userprofile";

      // Build path: <userId>/<timestamp>.<ext>
      const typeToExt: Record<string, string> = {
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/gif': 'gif',
      };
      const ext = typeToExt[file.type] || (file.name.split('.').pop() || 'jpg');
      const filePath = `${user.id}/${Date.now()}.${ext}`;

      // Upload to Supabase Storage
      const { data, error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, file, { upsert: true, contentType: file.type, cacheControl: '3600' });

      if (uploadError) {
        console.error("Supabase upload error:", uploadError);
        setError(uploadError.message || "Failed to upload photo");
        return;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath);

      setProfilePhoto(publicUrl);
      try {
        const api = createApi(supabase);
        await api.patch("/api/user/profile", { profilePhoto: publicUrl });
      } catch (e: any) {
        console.error("Failed to persist profile photo URL:", e);
      }
      setSuccess("Photo uploaded successfully!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error("Photo upload error:", err);
      setError(err?.message || "Failed to upload photo");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSaveProfile = async () => {
    setError(null);
    setSuccess(null);

    const trimmed = username.trim();

    // Validate format
    const formatError = validateUsernameFormat(trimmed);
    if (formatError) {
      setError(formatError);
      return;
    }

    if (!trimmed) {
      setError("Username is required");
      return;
    }

    // If still checking, wait
    if (checkingUsername) {
      setError("Please wait for username availability check to complete");
      return;
    }

    // Only block if explicitly marked as unavailable
    if (usernameAvailable === false) {
      setError("This username is already taken");
      return;
    }

    try {
      setLoading(true);
      const api = createApi(supabase);

      // Update profile in backend
      await api.patch("/api/user/profile", {
        username: username.trim(),
        profilePhoto,
        theme,
      });

      setSuccess("Profile updated successfully!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err?.message || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    setError(null);
    setSuccess(null);

    try {
      setLoading(true);
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/auth/forgot`,
      });
      setSuccess("Password reset link sent to your email");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err?.message || "Failed to send reset link");
    } finally {
      setLoading(false);
    }
  };

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        ref={modalRef}
        className="w-full max-w-md rounded-xl border border-border-default bg-bg-elevated shadow-elevation max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between border-b border-border-default bg-bg-elevated px-6 py-4">
          <h2 className="text-lg font-semibold text-text-primary">Profile & Settings</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 hover:bg-bg-hover transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-text-secondary" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border-default bg-bg-primary">
          <button
            onClick={() => setActiveTab("profile")}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "profile"
                ? "border-b-2 border-accent text-accent"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            Profile
          </button>
          <button
            onClick={() => setActiveTab("account")}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "account"
                ? "border-b-2 border-accent text-accent"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            Account
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-6">
          {/* Alerts */}
          {error && (
            <div className="flex items-start gap-3 rounded-lg bg-red-950/30 border border-red-500/30 p-4">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}
          {success && (
            <div className="flex items-start gap-3 rounded-lg bg-green-950/30 border border-green-500/30 p-4">
              <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-300">{success}</p>
            </div>
          )}

          {/* Profile Tab */}
          {activeTab === "profile" && (
            <div className="space-y-5">
              {profileLoading ? (
                // Loading skeleton
                <div className="space-y-5">
                  <div>
                    <div className="h-4 w-20 bg-bg-hover rounded animate-pulse mb-2" />
                    <div className="h-10 w-full bg-bg-hover rounded-md animate-pulse" />
                    <div className="h-3 w-32 bg-bg-hover rounded mt-2 animate-pulse" />
                  </div>
                </div>
              ) : (
                <>
                  {/* Profile Photo - MOVED TO TOP */}
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">
                      Profile Photo
                    </label>
                    <div className="flex items-center gap-4">
                      {profilePhoto ? (
                        <img
                          src={profilePhoto}
                          alt="Profile"
                          className="w-16 h-16 rounded-full object-cover border border-border-default"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-bg-hover border border-border-default flex items-center justify-center">
                          <span className="text-text-tertiary text-sm">No photo</span>
                        </div>
                      )}
                      <div className="flex-1">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handlePhotoUpload(file);
                          }}
                          className="hidden"
                        />
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingPhoto}
                          className="flex items-center gap-2 rounded-md border border-border-default px-3 py-2 text-sm font-semibold text-text-primary hover:bg-bg-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <Upload className="w-4 h-4" />
                          {uploadingPhoto ? "Uploading…" : "Upload Photo"}
                        </button>
                        <p className="text-xs text-text-tertiary mt-2">Max 5MB, JPG/PNG</p>
                      </div>
                    </div>
                  </div>

                  {/* Username */}
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">
                      Username
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => handleUsernameChange(e.target.value)}
                        placeholder="your_username"
                        className={`w-full rounded-md bg-bg-primary border px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary outline-none transition-colors ${
                          usernameAvailable === true
                            ? "border-green-500/50 focus:border-green-500"
                            : usernameAvailable === false
                            ? "border-red-500/50 focus:border-red-500"
                            : "border-border-default focus:border-accent"
                        }`}
                      />
                      {checkingUsername && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                      {!checkingUsername && usernameAvailable === true && (
                        <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-400" />
                      )}
                      {!checkingUsername && usernameAvailable === false && (
                        <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-400" />
                      )}
                    </div>
                    <p className="text-xs text-text-tertiary mt-1">
                      3-20 characters, letters, numbers, underscores, and hyphens only
                    </p>
                    {usernameAvailable === false && (
                      <p className="text-xs text-red-400 mt-1">This username is already taken</p>
                    )}
                    {usernameAvailable === true && (
                      <p className="text-xs text-green-400 mt-1">This username is available</p>
                    )}
                  </div>

                  {/* Theme Toggle */}
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">
                      Theme
                    </label>
                    <div className="flex items-center gap-3">
                      <TTClassic
                        toggled={isDark}
                        toggle={async (next: boolean | ((prev: boolean) => boolean)) => {
                          const resolved = typeof next === "function" ? next(isDark) : next;
                          const newTheme = resolved ? "dark" : "light";
                          setTheme(newTheme);
                          setGlobalTheme(newTheme);
                          // Persist immediately
                          try {
                            const api = createApi(supabase);
                            await api.patch("/api/user/profile", { theme: newTheme });
                          } catch (e) {
                            // non-fatal
                            console.error("Failed to persist theme:", e);
                          }
                        }}
                        duration={750}
                        className="text-accent"
                        style={{ fontSize: '2em' }}
                        title={isDark ? "Switch to light mode" : "Switch to dark mode"}
                      />
                      <span className="text-sm text-text-secondary">
                        {isDark ? "Dark Mode" : "Light Mode"}
                      </span>
                    </div>
                  </div>

                  {/* Save Button */}
                  <button
                    onClick={handleSaveProfile}
                    disabled={loading || usernameAvailable === false}
                    className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-black hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-micro"
                  >
                    {loading ? "Saving…" : "Save Profile"}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Account Tab */}
          {activeTab === "account" && (
            <div className="space-y-5">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  disabled
                  className="w-full rounded-md bg-bg-primary border border-border-default px-3 py-2 text-sm text-text-tertiary outline-none cursor-not-allowed"
                />
                <p className="text-xs text-text-tertiary mt-1">Email cannot be changed here</p>
              </div>

              {/* Change Password */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Password
                </label>
                <button
                  onClick={handleChangePassword}
                  disabled={loading}
                  className="w-full rounded-md border border-border-default px-4 py-2.5 text-sm font-semibold text-text-primary hover:bg-bg-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-micro"
                >
                  {loading ? "Sending…" : "Change Password"}
                </button>
                <p className="text-xs text-text-tertiary mt-1">
                  We'll send a reset link to your email
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
