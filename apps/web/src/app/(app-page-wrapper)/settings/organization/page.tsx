"use client";


import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthSession } from "@/app/providers";
import {
  deleteOrganizationAvatar,
  getMyOrganization,
  updateOrganization,
  updateOrganizationLanguage,
  uploadOrganizationAvatar,
} from "@/api";
import { Card, CardContent } from "@onehash/ui/card";
import { InputField } from "@onehash/ui/input";
import { Separator } from "@onehash/ui/separator";
import { Button } from "@onehash/ui/button";
import { Avatar } from "@onehash/ui/avatar";
import { Trash2, Upload } from "lucide-react";
import { toast } from "@onehash/ui/sonner";
import { useTranslation } from "react-i18next";
import { ImageCropDialog } from "@/components/common/ImageCropDialog";
import { JOBS_PAGE_LANGUAGES } from "@/i18n";
import { SelectField } from "@onehash/ui/select";

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
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const previewObjectUrlRef = useRef<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [jobsPageLanguage, setJobsPageLanguage] = useState("en");
  const [savingLanguage, setSavingLanguage] = useState(false);

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
          setJobsPageLanguage(resp.jobs_page_language ?? "en");
        }
      } catch {
        // keep page usable
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.org_id]);

  const avatarDirty =
    pendingAvatarRemoved || pendingAvatarFile !== null || avatarUrl !== originalAvatarUrl;
  const isDirty = name !== originalName || website !== originalWebsite || avatarDirty;
  const canSave = isDirty && name.trim().length > 0 && !saving;

  const handleLanguageSave = async (lng: string) => {
    setSavingLanguage(true);
    try {
      await updateOrganizationLanguage(lng);
      setJobsPageLanguage(lng);
      toast.success(t("language_saved"));
    } catch {
      toast.error(t("error"));
    } finally {
      setSavingLanguage(false);
    }
  };

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
      setPendingAvatarFile(null);
      setPendingAvatarRemoved(false);
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
        previewObjectUrlRef.current = null;
      }
      if (avatarInputRef.current) avatarInputRef.current.value = "";

      toast.success(t("org_settings_saved"));
    } catch (err) {
      const message = err instanceof Error ? err.message : t("settings_save_failed");
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleCropDialogOpenChange = (open: boolean) => {
    if (!open) {
      if (cropImageSrc) {
        URL.revokeObjectURL(cropImageSrc);
        setCropImageSrc(null);
      }
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
    setCropDialogOpen(open);
  };

  const handleAvatarFileSelected = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    const src = URL.createObjectURL(file);
    setCropImageSrc(src);
    setCropDialogOpen(true);
  };

  const handleAvatarCropped = (file: File) => {
    if (cropImageSrc) {
      URL.revokeObjectURL(cropImageSrc);
      setCropImageSrc(null);
    }
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
    }
    const objectUrl = URL.createObjectURL(file);
    previewObjectUrlRef.current = objectUrl;
    setAvatarUrl(objectUrl);
    setPendingAvatarFile(file);
    setPendingAvatarRemoved(false);
    toast.success("Organization avatar selected. Click Save to apply.");
  };

  const handleAvatarDelete = () => {
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = null;
    }
    setAvatarUrl(null);
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
      <ImageCropDialog
        open={cropDialogOpen}
        onOpenChange={handleCropDialogOpenChange}
        imageSrc={cropImageSrc}
        title="Adjust organization logo"
        onCropComplete={handleAvatarCropped}
      />

      <h2 className="text-base md:text-lg font-semibold mb-1">{t("nav_organization")}</h2>
      <p className="text-xs text-muted-foreground mb-4 md:mb-6">{t("manage_org_settings")}</p>

      <Card>
        <CardContent className="p-4 md:p-5 space-y-4">
          <div className="flex items-center gap-3">
            <Avatar
              key={avatarUrl ?? "none"}
              className="h-16 w-16"
              src={avatarUrl}
              alt={name || "Organization"}
              fallbackClassName="text-lg bg-gray-100 border border-gray-300 text-gray-700"
            />
            <div className="flex items-center gap-2">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => handleAvatarFileSelected(e.target.files?.[0])}
              />
              <Button
                size="sm"
                type="button"
                variant="outline"
                className="text-xs h-8"
                onClick={() => avatarInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-1.5" />
                {t("upload_photo")}
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
                  {t("remove_photo")}
                </Button>
              ) : null}
            </div>
          </div>
          <Separator />
          <InputField
            label={t("org_name_label")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter organization name"
            className="text-sm h-10 md:h-9"
          />
          <InputField
            label={t("org_website_label")}
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="Enter company's website"
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

      <h2 className="text-base md:text-lg font-semibold mb-1 mt-8">{t("language")}</h2>
      <p className="text-xs text-muted-foreground mb-4 md:mb-6">
        {t("jobs_page_language_description")}
      </p>
      <Card>
        <CardContent className="p-4 md:p-5">
          <SelectField
            label={t("jobs_page_language")}
            value={jobsPageLanguage}
            onValueChange={(val) => void handleLanguageSave(val)}
            options={JOBS_PAGE_LANGUAGES.map((l) => ({ value: l.code, label: l.label }))}
            disabled={savingLanguage}
          />
        </CardContent>
      </Card>
    </>
  );
}
