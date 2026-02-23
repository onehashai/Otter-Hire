"use client";

import { useState, useEffect } from "react";
import { type AuthSessionResponse } from "@/api";
import { Card, CardContent } from "@onehash/ui/card";
import { InputField } from "@onehash/ui/input";
import { Separator } from "@onehash/ui/separator";
import { Button } from "@onehash/ui/button";
import { Avatar, AvatarFallback } from "@onehash/ui/avatar";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

type ProfileSettingsProps = {
  user: AuthSessionResponse | null;
};

export function ProfileSettings({ user }: ProfileSettingsProps) {
  const { t } = useTranslation();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [originalName, setOriginalName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      const userName = user.name || "";
      const userEmail = user.email || "";
      setName(userName);
      setEmail(userEmail);
      setOriginalName(userName);
    }
  }, [user]);

  const isDirty = name !== originalName;
  const canSave = isDirty && name.trim().length > 0 && !saving;

  const getInitials = () => {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
    }
    return name.charAt(0).toUpperCase() || "U";
  };

  const handleSave = async () => {
    if (!canSave) return;

    setSaving(true);
    try {
      // TODO: Implement updateProfile API call
      // await updateProfile({ name: name.trim() });

      setOriginalName(name.trim());

      toast.success("Profile updated successfully");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update profile";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <h2 className="text-base md:text-lg font-semibold mb-1">Profile</h2>
      <p className="text-xs text-muted-foreground mb-4 md:mb-6">Manage your personal information</p>

      <div className="space-y-6">
        <Card>
          <CardContent className="p-4 md:p-5 space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="text-lg">{getInitials()}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="text-sm font-medium">{name || "User"}</p>
                <p className="text-xs text-muted-foreground">{email}</p>
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
            >
              {t("save")}
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
