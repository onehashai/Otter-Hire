"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthSession } from "@/app/providers";
import {
  deleteOrganizationAvatar,
  getMyOrganization,
  updateOrganization,
  uploadOrganizationAvatar,
} from "@/api";
import { Card, CardContent } from "@onehash/ui/card";
import { InputField } from "@onehash/ui/input";
import { Separator } from "@onehash/ui/separator";
import { Button } from "@onehash/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@onehash/ui/avatar";
import { Building2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export default function OrganizationSettings() {
  const { t } = useTranslation();
  const { user, refreshSession } = useAuthSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [originalName, setOriginalName] = useState("");
  const [originalWebsite, setOriginalWebsite] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [originalAvatarUrl, setOriginalAvatarUrl] = useState<string | null>(null);
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const [pendingAvatarRemoved, setPendingAvatarRemoved] = useState(false);
  const [avatarFallbackMode, setAvatarFallbackMode] = useState<"initial" | "dummy">("initial");
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const previewObjectUrlRef = useRef<string | null>(null);
  const avatarModeStorageKey = user?.org_id ? `org_avatar_fallback_mode:${user.org_id}` : null;
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (searchParams.get("tab") === "careers") {
      router.replace("/settings/integrations?app=email-integration&source=organization");
    }
  }, [router, searchParams]);

  useEffect(() => {
    if (user) {
      const orgName = user.org_name || "";
      const orgWebsite = user.org_website || "";
      setName(orgName);
      setWebsite(orgWebsite);
      setOriginalName(orgName);
      setOriginalWebsite(orgWebsite);
    }
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await getMyOrganization();
        if (!cancelled) {
          setAvatarUrl(resp.avatar_url ?? null);
          setOriginalAvatarUrl(resp.avatar_url ?? null);
          const persistedMode =
            typeof window !== "undefined" && avatarModeStorageKey
              ? window.localStorage.getItem(avatarModeStorageKey)
              : null;
          if (resp.avatar_url) {
            setAvatarFallbackMode("dummy");
            if (avatarModeStorageKey) {
              window.localStorage.setItem(avatarModeStorageKey, "dummy");
            }
          } else {
            setAvatarFallbackMode(persistedMode === "dummy" ? "dummy" : "initial");
          }
        }
      } catch {
        // keep page usable
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [avatarModeStorageKey, user?.org_name, user?.org_website]);

  const avatarDirty =
    pendingAvatarRemoved || pendingAvatarFile !== null || avatarUrl !== originalAvatarUrl;
  const isDirty = name !== originalName || website !== originalWebsite || avatarDirty;
  const canSave = isDirty && name.trim().length > 0 && !saving;

  const getInitial = () => {
    const normalized = name.trim();
    return normalized.charAt(0).toUpperCase() || "O";
  };

  const handleSave = async () => {
    if (!canSave) return;

    setSaving(true);
    try {
      await updateOrganization({
        name: name.trim(),
        website: website.trim() || null,
      });

      let nextAvatarUrl = avatarUrl;
      if (pendingAvatarRemoved) {
        const removed = await deleteOrganizationAvatar();
        nextAvatarUrl = removed.avatar_url ?? null;
      } else if (pendingAvatarFile) {
        const uploaded = await uploadOrganizationAvatar(pendingAvatarFile);
        nextAvatarUrl = uploaded.avatar_url ?? null;
      }

      await refreshSession(true);

      setOriginalName(name.trim());
      setOriginalWebsite(website.trim());
      setAvatarUrl(nextAvatarUrl ?? null);
      setOriginalAvatarUrl(nextAvatarUrl ?? null);
      if (pendingAvatarRemoved || pendingAvatarFile) {
        setAvatarFallbackMode("dummy");
        if (avatarModeStorageKey) {
          window.localStorage.setItem(avatarModeStorageKey, "dummy");
        }
      }
      setPendingAvatarFile(null);
      setPendingAvatarRemoved(false);
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
        previewObjectUrlRef.current = null;
      }
      if (avatarInputRef.current) avatarInputRef.current.value = "";

      toast.success("Organization settings saved");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save settings";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = (file: File | undefined) => {
    if (!file) return;
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
    }
    const objectUrl = URL.createObjectURL(file);
    previewObjectUrlRef.current = objectUrl;
    setAvatarUrl(objectUrl);
    setPendingAvatarFile(file);
    setPendingAvatarRemoved(false);
    setAvatarFallbackMode("dummy");
    toast.success("Organization avatar selected. Click Save to apply.");
  };

  const handleAvatarDelete = () => {
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = null;
    }
    setAvatarUrl(null);
    setAvatarFallbackMode("dummy");
    if (pendingAvatarFile) {
      setPendingAvatarFile(null);
      setPendingAvatarRemoved(false);
    } else {
      setPendingAvatarRemoved(Boolean(originalAvatarUrl));
    }
    if (avatarInputRef.current) avatarInputRef.current.value = "";
    toast.success("Organization avatar removal staged. Click Save to apply.");
  };

  return (
    <>
      <h2 className="text-base md:text-lg font-semibold mb-1">Organization</h2>
      <p className="text-xs text-muted-foreground mb-4 md:mb-6">
        Manage your organization profile settings
      </p>

      <Card>
        <CardContent className="p-4 md:p-5 space-y-4">
          <div className="flex items-center gap-3">
            <Avatar key={`${avatarUrl ?? "none"}-${avatarFallbackMode}`} className="h-16 w-16">
              {avatarUrl ? <AvatarImage src={avatarUrl} alt={name || "Organization"} /> : null}
              <AvatarFallback className="text-lg bg-gray-100 border border-gray-300 text-gray-700">
                {avatarFallbackMode === "initial" ? (
                  getInitial()
                ) : (
                  <Building2 className="h-7 w-7 text-muted-foreground" />
                )}
              </AvatarFallback>
            </Avatar>
            <div className="flex items-center gap-2">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => handleAvatarChange(e.target.files?.[0])}
              />
              <Button
                size="sm"
                type="button"
                variant="outline"
                className="text-xs h-8"
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
                >
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  Remove
                </Button>
              ) : null}
            </div>
          </div>
          <Separator />
          <InputField
            label="Organization Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter organization name"
            className="text-sm h-10 md:h-9"
          />
          <InputField
            label="Website"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="Enter company's website"
            className="text-sm h-10 md:h-9"
          />
          <Separator />
          <Button size="sm" className="text-xs h-9 md:h-8" onClick={handleSave} disabled={!canSave}>
            {t("save")}
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
