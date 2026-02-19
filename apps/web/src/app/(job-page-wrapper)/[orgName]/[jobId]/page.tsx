"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Button,
  Separator,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  InputField,
  Label,
} from "@onehash/ui";
import {
  ArrowLeft,
  ChevronLeft,
  MapPin,
  Briefcase,
  Clock,
  DollarSign,
  Building2,
  Upload,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/* ───── mock published job data ───── */
const publishedJobs: Record<
  string,
  {
    title: string;
    department: string;
    organization: string;
    employmentType: string;
    workplaceType: string;
    location: string;
    salaryRange: string | null;
    status: "published" | "draft";
    description: string;
    hiringTeam: { name: string; role: string }[];
  }
> = {
  "senior-frontend-engineer": {
    title: "Senior Frontend Engineer",
    department: "Engineering",
    organization: "Acme Inc.",
    employmentType: "Full-time",
    workplaceType: "Remote",
    location: "San Francisco, United States",
    salaryRange: "$140,000 – $180,000 / year",
    status: "published",
    description: `<h2>About the Role</h2>
<p>We're looking for a Senior Frontend Engineer to lead our design system efforts and build delightful user experiences.</p>
<h2>Responsibilities</h2>
<ul>
<li>Architect and maintain our React component library</li>
<li>Collaborate with design on new features</li>
<li>Mentor junior engineers</li>
<li>Drive frontend architecture decisions</li>
<li>Ensure performance and accessibility standards</li>
</ul>
<h2>Requirements</h2>
<ul>
<li>5+ years of frontend experience</li>
<li>Strong TypeScript and React skills</li>
<li>Experience with design systems</li>
<li>Excellent communication skills</li>
<li>Passion for clean, maintainable code</li>
</ul>`,
    hiringTeam: [
      { name: "Jane Doe", role: "Hiring Manager" },
      { name: "John Smith", role: "Recruiter" },
    ],
  },
  "product-designer": {
    title: "Product Designer",
    department: "Design",
    organization: "Acme Inc.",
    employmentType: "Full-time",
    workplaceType: "Hybrid",
    location: "New York, United States",
    salaryRange: "$120,000 – $160,000 / year",
    status: "published",
    description: `<h2>About the Role</h2><p>Join our design team to craft beautiful, intuitive product experiences.</p><h2>Requirements</h2><ul><li>3+ years of product design experience</li><li>Proficiency in Figma</li><li>Strong portfolio</li></ul>`,
    hiringTeam: [{ name: "Sarah Lee", role: "Hiring Manager" }],
  },
  "engineering-manager": {
    title: "Engineering Manager",
    department: "Engineering",
    organization: "Acme Inc.",
    employmentType: "Full-time",
    workplaceType: "On-site",
    location: "Austin, United States",
    salaryRange: "$160,000 – $200,000 / year",
    status: "published",
    description: `<h2>About the Role</h2><p>Lead and grow a high-performing engineering team building cutting-edge products.</p><h2>Requirements</h2><ul><li>7+ years of engineering experience</li><li>3+ years of management experience</li><li>Track record of building high-performing teams</li></ul>`,
    hiringTeam: [{ name: "Alex Chen", role: "VP Engineering" }],
  },
  "data-scientist": {
    title: "Data Scientist",
    department: "Data",
    organization: "Acme Inc.",
    employmentType: "Contract",
    workplaceType: "Remote",
    location: "Remote",
    salaryRange: null,
    status: "published",
    description: `<h2>About the Role</h2><p>Derive insights from complex datasets to drive product decisions.</p><h2>Requirements</h2><ul><li>MS/PhD in relevant field</li><li>Proficiency in Python and SQL</li><li>Experience with ML frameworks</li></ul>`,
    hiringTeam: [],
  },
};

export default function CareerJobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const isMobile = useIsMobile();
  const orgName = params?.orgName as string;
  const jobId = params?.jobId as string;
  const job = jobId ? publishedJobs[jobId] : undefined;

  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [applyForm, setApplyForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    resume: null as File | null,
    coverLetter: "",
  });
  const [applySubmitting, setApplySubmitting] = useState(false);

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
    // TODO: submit to API (orgName, jobId, applyForm)
    setTimeout(() => {
      setApplySubmitting(false);
      closeApplyDialog();
      toast.success("Application submitted. We'll be in touch!");
    }, 600);
  };

  if (!job) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center space-y-3 max-w-sm">
          <h1 className="text-xl font-semibold">Job not found</h1>
          <p className="text-sm text-muted-foreground">
            This job posting is no longer available or has not been published.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="text-xs mt-4"
            onClick={() => router.push(orgName ? `/${encodeURIComponent(orgName)}` : "/")}
          >
            <ChevronLeft className="h-3.5 w-3.5 mr-1.5" /> View all positions
          </Button>
        </div>
      </div>
    );
  }

  const isDraft = job.status === "draft";

  const metaItems = [
    job.location && { icon: MapPin, label: job.location },
    { icon: Briefcase, label: job.employmentType },
    { icon: Clock, label: job.workplaceType },
    job.salaryRange && { icon: DollarSign, label: job.salaryRange },
    { icon: Building2, label: job.department },
  ].filter(Boolean) as { icon: React.ElementType; label: string }[];

  const listHref = orgName ? `/${encodeURIComponent(orgName)}` : "/";

  return (
    <div className="min-h-screen bg-background">
      {/* Draft banner */}
      {isDraft && (
        <div className="border-b border-border bg-muted/50">
          <div className="mx-auto max-w-3xl px-4 py-2.5">
            <p className="text-xs text-muted-foreground text-center">
              This job is not published yet. Only visible to your organization.
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-border">
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => router.push(listHref)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="h-7 w-7 rounded-md bg-foreground flex items-center justify-center shrink-0">
              <span className="text-background text-[10px] font-bold">A</span>
            </div>
            <span className="text-xs text-muted-foreground truncate">
              {job.organization}
            </span>
          </div>
          <Link
            href={listHref}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors hidden sm:block"
          >
            All positions
          </Link>
        </div>
      </header>

      {/* Hero */}
      <div className="mx-auto max-w-3xl px-4 pt-8 md:pt-12 pb-6 md:pb-8">
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              {job.organization}
            </p>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
              {job.title}
            </h1>
          </div>

          <div className="flex flex-wrap gap-2">
            {metaItems.map((item, i) => (
              <div
                key={i}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground"
              >
                <item.icon className="h-3 w-3 shrink-0" />
                <span>{item.label}</span>
              </div>
            ))}
          </div>

          <div className={cn("pt-2")}>
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

      {/* Content */}
      <div className="mx-auto max-w-3xl px-4 py-8 md:py-10 space-y-10">
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

        <Separator />

        {/* Bottom CTA */}
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

      {/* Apply dialog */}
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
              Submit your application to {job.organization}. We'll review it and get back to you.
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
                  <Upload className="h-4 w-4 shrink-0" />
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

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto max-w-3xl px-4 py-6 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} {job.organization}
          </p>
          <Link
            href={listHref}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            View all positions
          </Link>
        </div>
      </footer>
    </div>
  );
}
