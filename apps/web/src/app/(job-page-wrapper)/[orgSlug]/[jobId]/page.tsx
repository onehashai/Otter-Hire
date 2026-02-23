"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@onehash/ui/button";
import { Separator } from "@onehash/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@onehash/ui/dialog";
import { InputField } from "@onehash/ui/input";
import { Label } from "@onehash/ui/label";
import { Icon } from "@onehash/ui/icon";
import type { IconName } from "@onehash/ui/icon";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getPublicJobDetail, type PublicJobDetail } from "@/api";

function parseOrgSlug(orgSlug: string): { orgName: string; orgId: string } | null {
  const parts = orgSlug.split("-");
  if (parts.length < 6) return null;
  
  const uuidParts = parts.slice(-5);
  const orgId = uuidParts.join("-");
  const orgName = parts.slice(0, -5).join("-");
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(orgId)) return null;
  
  return { orgName, orgId };
}

function formatSalary(job: PublicJobDetail): string | null {
  if (job.salary_fixed) {
    return `$${(job.salary_fixed / 100).toLocaleString()} / ${job.salary_timeframe.replace("per_", "")}`;
  }
  if (job.salary_min && job.salary_max) {
    return `$${(job.salary_min / 100).toLocaleString()} – $${(job.salary_max / 100).toLocaleString()} / ${job.salary_timeframe.replace("per_", "")}`;
  }
  return null;
}

function formatLocation(job: PublicJobDetail): string {
  if (job.city && job.country) return `${job.city}, ${job.country}`;
  if (job.city) return job.city;
  if (job.country) return job.country;
  return job.workplace_type || "Remote";
}

function formatEmploymentType(type: string): string {
  return type.replace("_", "-").replace(/\b\w/g, (l) => l.toUpperCase());
}

export default function CareerJobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const isMobile = useIsMobile();
  const orgSlug = params?.orgSlug as string;
  const jobId = params?.jobId as string;

  const [job, setJob] = useState<PublicJobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [orgName, setOrgName] = useState("");

  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [applyForm, setApplyForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    resume: null as File | null,
    coverLetter: "",
  });
  const [applySubmitting, setApplySubmitting] = useState(false);

  useEffect(() => {
    const parsed = parseOrgSlug(orgSlug);
    if (!parsed) {
      setError("Invalid organization");
      setLoading(false);
      return;
    }

    setOrgName(parsed.orgName);

    getPublicJobDetail(parsed.orgId, jobId)
      .then((data) => {
        setJob(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Job not found");
        setLoading(false);
      });
  }, [orgSlug, jobId]);

  const openApplyDialog = () => setApplyDialogOpen(true);
  const closeApplyDialog = () => {
    setApplyDialogOpen(false);
    setApplyForm({ fullName: "", email: "", phone: "", resume: null, coverLetter: "" });
  };

  const handleApplySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyForm.fullName.trim() || !applyForm.email.trim()) {
      toast.error("Please enter your name and email.");
      return;
    }
    if (!applyForm.resume) {
      toast.error("Please upload your resume.");
      return;
    }
    setApplySubmitting(true);
    setTimeout(() => {
      setApplySubmitting(false);
      closeApplyDialog();
      toast.success("Application submitted. We'll be in touch!");
    }, 600);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center space-y-3 max-w-sm">
          <h1 className="text-xl font-semibold">Job not found</h1>
          <p className="text-sm text-muted-foreground">
            {error || "This job posting is no longer available."}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="text-xs mt-4"
            onClick={() => router.push(`/${orgSlug}`)}
          >
            <Icon name="ChevronLeft" className="h-3.5 w-3.5 mr-1.5" /> View all positions
          </Button>
        </div>
      </div>
    );
  }

  const salary = formatSalary(job);
  const location = formatLocation(job);
  const employmentType = formatEmploymentType(job.employment_type);

  const metaItems = [
    { iconName: "MapPin", label: location },
    { iconName: "Briefcase", label: employmentType },
    { iconName: "Clock", label: job.workplace_type },
    salary && { iconName: "DollarSign", label: salary },
    job.department && { iconName: "Building2", label: job.department },
  ].filter(Boolean) as { iconName: IconName; label: string }[];

  const listHref = `/${orgSlug}`;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => router.push(listHref)}
          >
            <Icon name="ChevronLeft" className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="h-7 w-7 rounded-md bg-foreground flex items-center justify-center shrink-0">
              <span className="text-background text-[10px] font-bold">
                {orgName.charAt(0).toUpperCase()}
              </span>
            </div>
            <span className="text-xs text-muted-foreground truncate capitalize">
              {job.org_name}
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 pt-8 md:pt-12 pb-6 md:pb-8">
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground capitalize">
              {job.org_name}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
                {job.title}
              </h1>
              {job.status === "draft" && (
                <Badge variant="secondary" className="text-[10px] h-5 px-2">
                  Draft
                </Badge>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {metaItems.map((item, i) => (
              <div
                key={i}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground"
              >
                <Icon name={item.iconName} className="h-3 w-3 shrink-0" />
                <span>{item.label}</span>
              </div>
            ))}
          </div>

          <div className="pt-2">
            <Button
              size={isMobile ? "lg" : "default"}
              className={cn("text-sm", isMobile && "w-full h-12")}
              onClick={openApplyDialog}
            >
              Apply for this position
            </Button>
          </div>
        </div>
      </div>

      <Separator />

      <div className="mx-auto max-w-3xl px-4 py-8 md:py-10 space-y-10">
        {job.description ? (
          <div
            className="prose prose-sm max-w-none text-foreground 
              [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-8 [&_h2]:mb-3
              [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-2
              [&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-muted-foreground [&_p]:mb-3
              [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5
              [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1.5
              [&_li]:text-sm [&_li]:text-muted-foreground [&_li]:leading-relaxed
              [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-2"
            dangerouslySetInnerHTML={{ __html: job.description }}
          />
        ) : (
          <p className="text-sm text-muted-foreground">No description available.</p>
        )}

        <Separator />

        <div className="text-center space-y-3 py-4">
          <h2 className="text-lg font-semibold">Interested in this role?</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            We&apos;d love to hear from you. Apply now and our team will review
            your application.
          </p>
          <Button
            size={isMobile ? "lg" : "default"}
            className={cn("text-sm mt-2", isMobile && "w-full h-12")}
            onClick={openApplyDialog}
          >
            Apply for this position
          </Button>
        </div>
      </div>

      <Dialog
        open={applyDialogOpen}
        onOpenChange={(open) => {
          setApplyDialogOpen(open);
          if (!open) setApplyForm({ fullName: "", email: "", phone: "", resume: null, coverLetter: "" });
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Apply for {job.title}</DialogTitle>
            <DialogDescription>
              Submit your application to {job.org_name}. We'll review it and get back to you.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleApplySubmit} className="space-y-4 mt-2">
            <div>
              <Label className="text-xs">Full name</Label>
              <InputField
                value={applyForm.fullName}
                onChange={(e) => setApplyForm((f) => ({ ...f, fullName: e.target.value }))}
                placeholder="Jane Doe"
                className="mt-1.5 h-9 text-sm"
                required
              />
            </div>
            <div>
              <Label className="text-xs">Email</Label>
              <InputField
                type="email"
                value={applyForm.email}
                onChange={(e) => setApplyForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="jane@example.com"
                className="mt-1.5 h-9 text-sm"
                required
              />
            </div>
            <div>
              <Label className="text-xs">Phone (optional)</Label>
              <InputField
                type="tel"
                value={applyForm.phone}
                onChange={(e) => setApplyForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+1 234 567 8900"
                className="mt-1.5 h-9 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Resume</Label>
              <div className="mt-1.5 flex items-center gap-2">
                <label className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-border border-dashed px-4 py-3 text-xs text-muted-foreground hover:bg-muted/50 cursor-pointer transition-colors">
                  <Icon name="Upload" className="h-4 w-4 shrink-0" />
                  <span>{applyForm.resume ? applyForm.resume.name : "Choose file or drag and drop"}</span>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    className="sr-only"
                    onChange={(e) => setApplyForm((f) => ({ ...f, resume: e.target.files?.[0] ?? null }))}
                  />
                </label>
              </div>
            </div>
            <div>
              <Label className="text-xs">Cover letter (optional)</Label>
              <textarea
                value={applyForm.coverLetter}
                onChange={(e) => setApplyForm((f) => ({ ...f, coverLetter: e.target.value }))}
                placeholder="Tell us why you're a great fit..."
                rows={3}
                className={cn(
                  "mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
                  "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                )}
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" size="sm" onClick={closeApplyDialog}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={applySubmitting}>
                {applySubmitting ? "Submitting…" : "Submit application"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <p className="text-xs text-muted-foreground capitalize text-center">
            © {new Date().getFullYear()} {job.org_name}
          </p>
        </div>
      </footer>
    </div>
  );
}
