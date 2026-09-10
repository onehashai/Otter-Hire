"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@onehash/ui/button";
import { API_BASE_URL } from "@/api";

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
    </div>
  );
}
