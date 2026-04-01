"use client";

import { useState, useEffect, useRef } from "react";
import {
  deleteMyAvatar,
  getMyProfile,
  type AuthSessionResponse,
  updateMyProfile,
  uploadMyAvatar,
} from "@/api";
import { Card, CardContent } from "@onehash/ui/card";
import { InputField } from "@onehash/ui/input";
import { Separator } from "@onehash/ui/separator";
import { Button } from "@onehash/ui/button";
import { Avatar } from "@onehash/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@onehash/ui/alert-dialog";
import { Trash2, Upload } from "lucide-react";
import { toast } from "@onehash/ui/sonner";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { getInitialsFromName } from "@/lib/name-initials";

type ProfileSettingsProps = {
  user: AuthSessionResponse | null;
};

export function ProfileSettings({ user }: ProfileSettingsProps) {
  const { t } = useTranslation();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [originalName, setOriginalName] = useState("");
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [originalAvatarUrl, setOriginalAvatarUrl] = useState<string | null>(null);
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const [pendingAvatarRemoved, setPendingAvatarRemoved] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingNavigateTo, setPendingNavigateTo] = useState<string | null>(null);
  const [pendingBackNavigation, setPendingBackNavigation] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const previewObjectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (user) {
      const userName = user.name || "";
      const userEmail = user.email || "";
      setName(userName);
      setEmail(userEmail);
      setOriginalName(userName);
    }
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const profile = await getMyProfile();
        if (!cancelled) {
          setAvatarUrl(profile.avatar_url ?? null);
          setOriginalAvatarUrl(profile.avatar_url ?? null);
          setName(profile.name || "");
          setOriginalName(profile.name || "");
        }
      } catch {
        // keep page usable
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.org_id]);

  const avatarDirty =
    pendingAvatarRemoved || pendingAvatarFile !== null || avatarUrl !== originalAvatarUrl;
  const isDirty = name !== originalName || avatarDirty;
  const canSave = isDirty && name.trim().length > 0 && !saving;

  const handleSave = async () => {
    if (!canSave) return;

    setSaving(true);
    try {
      const profile = await updateMyProfile(name.trim());
      let nextAvatarUrl = profile.avatar_url ?? avatarUrl;

      if (pendingAvatarRemoved) {
        const removed = await deleteMyAvatar();
        nextAvatarUrl = removed.avatar_url ?? null;
      } else if (pendingAvatarFile) {
        const uploaded = await uploadMyAvatar(pendingAvatarFile);
        nextAvatarUrl = uploaded.avatar_url ?? null;
      }

      setName(profile.name);
      setOriginalName(profile.name);
      setAvatarUrl(nextAvatarUrl ?? null);
      setOriginalAvatarUrl(nextAvatarUrl ?? null);
      setPendingAvatarFile(null);
      setPendingAvatarRemoved(false);

      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
        previewObjectUrlRef.current = null;
      }
      if (avatarInputRef.current) avatarInputRef.current.value = "";

      toast.success("Profile updated successfully");

      if (pendingBackNavigation) {
        setPendingBackNavigation(false);
        router.back();
        return;
      }

      if (pendingNavigateTo) {
        const target = pendingNavigateTo;
        setPendingNavigateTo(null);
        router.push(target);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update profile";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = async (file: File | undefined) => {
    if (!file) return;
    try {
      setAvatarUploading(true);
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
      }
      const objectUrl = URL.createObjectURL(file);
      previewObjectUrlRef.current = objectUrl;
      setAvatarUrl(objectUrl);
      setPendingAvatarFile(file);
      setPendingAvatarRemoved(false);
      toast.success("Avatar selected. Click Save to apply.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload avatar");
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleAvatarDelete = async () => {
    try {
      setAvatarUploading(true);
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
        previewObjectUrlRef.current = null;
      }
      setAvatarUrl(null);
      if (pendingAvatarFile) {
        // Removing a staged avatar selection should not hit delete API on save.
        setPendingAvatarFile(null);
        setPendingAvatarRemoved(false);
      } else {
        setPendingAvatarRemoved(Boolean(originalAvatarUrl));
      }
      if (avatarInputRef.current) avatarInputRef.current.value = "";
      toast.success("Avatar removal staged. Click Save to apply.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove avatar");
    } finally {
      setAvatarUploading(false);
    }
  };

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    const onClickCapture = (e: MouseEvent) => {
      if (!isDirty) return;
      const target = e.target as HTMLElement;
      const link = target.closest("a");
      if (!link) return;
      const href = link.getAttribute("href");
      if (!href || !href.startsWith("/")) return;
      e.preventDefault();
      e.stopPropagation();
      setPendingNavigateTo(href);
      setShowUnsavedDialog(true);
    };
    document.addEventListener("click", onClickCapture, true);
    return () => document.removeEventListener("click", onClickCapture, true);
  }, [isDirty]);

  useEffect(() => {
    if (!isDirty) return;
    // Push a guard history state so browser back can be intercepted while dirty.
    window.history.pushState(null, "", window.location.href);
    const onPopState = () => {
      if (!isDirty) return;
      setPendingBackNavigation(true);
      setShowUnsavedDialog(true);
      window.history.pushState(null, "", window.location.href);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [isDirty]);

  const handleDiscardChanges = () => {
    setName(originalName);
    setAvatarUrl(originalAvatarUrl);
    setPendingAvatarFile(null);
    setPendingAvatarRemoved(false);
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = null;
    }
    if (avatarInputRef.current) avatarInputRef.current.value = "";
    setShowUnsavedDialog(false);
    if (pendingBackNavigation) {
      setPendingBackNavigation(false);
      window.history.back();
      return;
    }
    if (pendingNavigateTo) {
      const target = pendingNavigateTo;
      setPendingNavigateTo(null);
      router.push(target);
    }
  };

  const handleSaveAndNavigate = () => {
    setShowUnsavedDialog(false);
    void handleSave();
  };

  return (
    <>
      <h2 className="text-base md:text-lg font-semibold mb-1">Profile</h2>
      <p className="text-xs text-muted-foreground mb-4 md:mb-6">Manage your personal information</p>

      <div className="space-y-6">
        <Card>
          <CardContent className="p-4 md:p-5 space-y-4">
            <div className="flex items-center gap-3">
              <Avatar
                key={avatarUrl ?? "none"}
                className="h-16 w-16"
                src={avatarUrl}
                alt={name || "User"}
                fallbackClassName="text-lg bg-gray-100 border border-gray-300 text-gray-700"
              >
                {getInitialsFromName(name.trim(), "U")}
              </Avatar>
              <div className="flex items-center gap-2">
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => handleAvatarChange(e.target.files?.[0])}
                  disabled={avatarUploading}
                />
                <Button
                  size="sm"
                  type="button"
                  variant="outline"
                  className="text-xs h-8"
                  disabled={avatarUploading}
                  onClick={() => avatarInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-1.5" />
                  Upload
                </Button>
                {avatarUrl ? (
                  <Button
                    size="sm"
                    type="button"
                    variant="outline"
                    className="text-xs h-8 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={handleAvatarDelete}
                    disabled={avatarUploading}
                  >
                    <Trash2 className="h-4 w-4 mr-1.5" />
                    Remove
                  </Button>
                ) : null}
              </div>
            </div>

            <Separator />

            <InputField
              label="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your full name"
              className="text-sm h-10 md:h-9"
            />

            <InputField
              label="Email"
              value={email}
              disabled
              placeholder="Email address"
              className="text-sm h-10 md:h-9"
            />

            <Separator />

            <Button
              size="sm"
              className="text-xs h-9 md:h-8"
              onClick={handleSave}
              disabled={!canSave}
              pending={saving}
            >
              {t("save")}
            </Button>
          </CardContent>
        </Card>
      </div>
      <AlertDialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved profile changes. Save before leaving?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDiscardChanges}>Discard</AlertDialogCancel>
            <AlertDialogAction onClick={handleSaveAndNavigate}>Save Changes</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
