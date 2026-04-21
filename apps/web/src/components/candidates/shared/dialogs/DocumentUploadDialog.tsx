"use client";

import { useTranslation } from "react-i18next";
import { Button } from "@onehash/ui/button";
import { SelectField } from "@onehash/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@onehash/ui/dialog";

type DocumentUploadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  docFile: File | null;
  onDocFileChange: (file: File | null) => void;
  docType: string;
  onDocTypeChange: (value: string) => void;
  loading: boolean;
  onUpload: () => void | Promise<void>;
};

export function DocumentUploadDialog({
  open,
  onOpenChange,
  docFile,
  onDocFileChange,
  docType,
  onDocTypeChange,
  loading,
  onUpload,
}: DocumentUploadDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("upload_document")}</DialogTitle>
          <DialogDescription>{t("upload_pdf_max")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium mb-1.5">{t("pdf_file_label")} *</p>
            <input
              type="file"
              accept="application/pdf,.pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => onDocFileChange(e.target.files?.[0] ?? null)}
              className="block w-full text-sm"
            />
          </div>
          <SelectField
            label={t("doc_type_label")}
            value={docType}
            onValueChange={onDocTypeChange}
            options={[
              { value: "attachment", label: t("doc_type_attachment") },
              { value: "portfolio", label: t("doc_type_portfolio") },
              { value: "certificate", label: t("doc_type_certificate") },
            ]}
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {t("cancel")}
          </Button>
          <Button type="button" onClick={() => void onUpload()} disabled={loading || !docFile}>
            {loading ? t("uploading") : t("upload_document")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
