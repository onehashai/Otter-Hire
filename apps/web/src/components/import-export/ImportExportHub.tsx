"use client";

import { useState } from "react";
import { Download, Eye, Upload } from "lucide-react";
import { Button } from "@onehash/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@onehash/ui/dialog";
import { API_BASE_URL } from "@/api";

const CSV_HEADERS = ["First Name", "Last Name", "E-Mail", "Phone", "Skills", "Resume Text"];
const SAMPLE_CSV_ROWS = [
  [
    "Avery",
    "Jordan",
    "avery.jordan@example.com",
    "+14155550123",
    "Recruiting; TypeScript; Customer success",
    "Experienced recruiter with five years of technical hiring experience.",
  ],
  [
    "Morgan",
    "Lee",
    "morgan.lee@example.com",
    "+14155550124",
    "Sales; Account management",
    "Customer-facing sales professional with enterprise account experience.",
  ],
];

function toCsv(rows: readonly (readonly string[])[]): string {
  return rows
    .map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(","))
    .join("\r\n");
}

function downloadCsv(filename: string, rows: readonly (readonly string[])[]): void {
  const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function MigrationSteps({ title, steps }: { title: string; steps: string[] }) {
  return (
    <section className="border-t px-5 py-5" aria-label={title}>
      <h4 className="font-semibold">{title}</h4>
      <ol className="mt-4 grid gap-4 text-sm md:grid-cols-2">
        {steps.map((step, index) => (
          <li key={step} className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted font-medium">
              {index + 1}
            </span>
            <span className="text-muted-foreground">{step}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function ImportExportHub() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState("");
  const [preview, setPreview] = useState<"sample" | "blank" | null>(null);

  const previewRows = preview === "sample" ? [CSV_HEADERS, ...SAMPLE_CSV_ROWS] : [CSV_HEADERS];

  async function importCsv() {
    if (!file) return;
    if (!window.confirm(`Import ${file.name} into your Otter Hire organization?`)) return;
    const body = new FormData();
    body.append("file", file);
    const response = await fetch(`${API_BASE_URL}/import-export/import/csv`, {
      method: "POST",
      body,
      credentials: "include",
    });
    const payload = await response.json();
    setResult(
      response.ok
        ? `${payload.successful} imported, ${payload.failed} failed`
        : payload.message || "Import failed",
    );
  }

  return (
    <div className="mt-8 rounded-lg border bg-card">
      <div className="border-b p-5">
        <h3 className="font-semibold">Import &amp; export</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Import candidate records from CSV files or export your candidates.
        </p>
      </div>
      <div className="space-y-3 p-5">
        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-medium">Candidate CSV template</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              Download a sample, replace its example rows with your candidate data, then upload it below.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-medium">Sample CSV</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    downloadCsv("otter-hire-candidate-sample.csv", [CSV_HEADERS, ...SAMPLE_CSV_ROWS])
                  }
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download sample CSV
                </Button>
                <Button type="button" variant="ghost" onClick={() => setPreview("sample")}>
                  <Eye className="mr-2 h-4 w-4" />
                  Preview
                </Button>
              </div>
            </div>
            <div className="space-y-2 sm:border-l sm:pl-4">
              <p className="text-sm font-medium">Blank template</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => downloadCsv("otter-hire-candidate-template.csv", [CSV_HEADERS])}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download blank template
                </Button>
                <Button type="button" variant="ghost" onClick={() => setPreview("blank")}>
                  <Eye className="mr-2 h-4 w-4" />
                  Preview
                </Button>
              </div>
            </div>
          </div>
        </div>
        <label className="flex min-h-24 cursor-pointer items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground hover:bg-muted/40">
          {file ? file.name : "Choose a CSV file"}
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
          />
        </label>
        <div className="flex gap-2">
          <Button onClick={importCsv} disabled={!file}>
            <Upload className="mr-2 h-4 w-4" />
            Import CSV
          </Button>
          <a
            className="inline-flex items-center rounded-md border px-4 text-sm"
            href={`${API_BASE_URL}/import-export/export/candidates`}
          >
            Export candidates
          </a>
        </div>
        {result && <p className="text-sm text-muted-foreground">{result}</p>}
        <MigrationSteps
          title="How to proceed with CSV"
          steps={[
            "Sign in to your Otter Hire account and open Data Migration.",
            "Prepare a CSV with candidate columns such as Full Name, E-Mail, Mobile, Skills, and Resume Text.",
            "Choose the CSV file and select Import CSV. Review the confirmation prompt before writing records.",
            "Review the imported and failed row counts, then open Candidates to verify the records.",
            "To download records, select Export candidates. The file is generated for your organization.",
          ]}
        />
      </div>
      <Dialog open={preview !== null} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{preview === "sample" ? "Sample CSV preview" : "Blank template preview"}</DialogTitle>
            <DialogDescription>
              {preview === "sample"
                ? "Replace the example rows with your candidate data before uploading."
                : "Use these headers as the first row of your CSV file."}
            </DialogDescription>
          </DialogHeader>
          <pre className="max-h-[45vh] overflow-auto rounded-md border bg-muted/30 p-4 text-xs leading-6">
            {toCsv(previewRows)}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
