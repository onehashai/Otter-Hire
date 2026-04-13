"use client";

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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
          <DialogDescription>Upload a PDF document (max 1MB).</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium mb-1.5">PDF File *</p>
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => onDocFileChange(e.target.files?.[0] ?? null)}
              className="block w-full text-sm"
            />
          </div>
          <SelectField
            label="Type"
            value={docType}
            onValueChange={onDocTypeChange}
            options={[
              { value: "attachment", label: "Attachment" },
              { value: "portfolio", label: "Portfolio" },
              { value: "certificate", label: "Certificate" },
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
            Cancel
          </Button>
          <Button type="button" onClick={() => void onUpload()} disabled={loading || !docFile}>
            {loading ? "Uploading..." : "Upload Document"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
