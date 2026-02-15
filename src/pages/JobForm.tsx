import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  ArrowLeft,
  ChevronRight,
  ChevronLeft,
  Save,
  Globe,
  Eye,
  Sparkles,
  GripVertical,
  Plus,
  X,
  Copy,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import TiptapEditor from "@/components/TiptapEditor";

/* ───── country/city data ───── */
const countryCities: Record<string, string[]> = {
  "United States": ["San Francisco", "New York", "Austin", "Seattle", "Chicago", "Los Angeles", "Boston", "Denver"],
  "United Kingdom": ["London", "Manchester", "Edinburgh", "Birmingham", "Bristol"],
  Germany: ["Berlin", "Munich", "Hamburg", "Frankfurt"],
  Canada: ["Toronto", "Vancouver", "Montreal", "Calgary"],
  Australia: ["Sydney", "Melbourne", "Brisbane", "Perth"],
  France: ["Paris", "Lyon", "Marseille", "Toulouse"],
  India: ["Bangalore", "Mumbai", "Delhi", "Hyderabad", "Chennai"],
  Netherlands: ["Amsterdam", "Rotterdam", "The Hague", "Utrecht"],
};

/* ───── mock data for edit mode ───── */
const mockJob = {
  title: "Senior Frontend Engineer",
  department: "Engineering",
  employmentType: "full-time",
  workplaceType: "remote",
  country: "United States",
  city: "San Francisco",
  hiringManager: "Jane Doe",
  status: "draft" as const,
  description:
    "<p>We're looking for a Senior Frontend Engineer to lead our design system efforts and build delightful user experiences.</p><h2>Responsibilities</h2><ul><li>Architect and maintain our React component library</li><li>Collaborate with design on new features</li><li>Mentor junior engineers</li></ul><h2>Requirements</h2><ul><li>5+ years of frontend experience</li><li>Strong TypeScript and React skills</li><li>Experience with design systems</li></ul>",
  openings: 2,
  salaryType: "range" as SalaryType,
  salaryFixed: "",
  salaryMin: "140000",
  salaryMax: "180000",
  currency: "USD",
  timeframe: "per year",
  pipeline: "standard",
  collectResume: true,
  collectCover: false,
  screeningQuestions: ["Why are you interested in this role?"],
  stages: [
    { name: "Phone Screen", interviewer: "Jane Doe" },
    { name: "Technical", interviewer: "John Smith" },
    { name: "Culture Fit", interviewer: "Sarah Lee" },
    { name: "Final", interviewer: "Jane Doe" },
  ],
  visibility: "careers" as Visibility,
};

type JobStatus = "draft" | "open" | "closed";
type Visibility = "internal" | "careers" | "public";
type SalaryType = "hidden" | "fixed" | "range";

const sections = [
  "Basic Info",
  "Description",
  "Hiring Details",
  "Application",
  "Interview Plan",
  "Visibility",
] as const;

export default function JobForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const isEdit = Boolean(id);

  /* ───── form state ───── */
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [employmentType, setEmploymentType] = useState("full-time");
  const [workplaceType, setWorkplaceType] = useState("remote");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [hiringManager, setHiringManager] = useState("");
  const [status, setStatus] = useState<JobStatus>("draft");
  const [description, setDescription] = useState("");
  const [openings, setOpenings] = useState(1);
  const [salaryType, setSalaryType] = useState<SalaryType>("hidden");
  const [salaryFixed, setSalaryFixed] = useState("");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [timeframe, setTimeframe] = useState("per year");
  const [pipeline, setPipeline] = useState("standard");
  const [collectResume, setCollectResume] = useState(true);
  const [collectCover, setCollectCover] = useState(false);
  const [screeningQuestions, setScreeningQuestions] = useState<string[]>([]);
  const [newQuestion, setNewQuestion] = useState("");
  const [stages, setStages] = useState([
    { name: "Phone Screen", interviewer: "" },
    { name: "Technical", interviewer: "" },
    { name: "Final", interviewer: "" },
  ]);
  const [visibility, setVisibility] = useState<Visibility>("careers");
  const [published, setPublished] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  /* ───── mobile wizard ───── */
  const [activeSection, setActiveSection] = useState(0);
  const [aiSheetOpen, setAiSheetOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  /* ───── city search ───── */
  const [citySearch, setCitySearch] = useState("");
  const availableCities = country ? (countryCities[country] || []) : [];
  const filteredCities = citySearch
    ? availableCities.filter((c) => c.toLowerCase().includes(citySearch.toLowerCase()))
    : availableCities;

  /* ───── load edit data ───── */
  useEffect(() => {
    if (isEdit) {
      setTitle(mockJob.title);
      setDepartment(mockJob.department);
      setEmploymentType(mockJob.employmentType);
      setWorkplaceType(mockJob.workplaceType);
      setCountry(mockJob.country);
      setCity(mockJob.city);
      setHiringManager(mockJob.hiringManager);
      setStatus(mockJob.status);
      setDescription(mockJob.description);
      setOpenings(mockJob.openings);
      setSalaryType(mockJob.salaryType);
      setSalaryFixed(mockJob.salaryFixed);
      setSalaryMin(mockJob.salaryMin);
      setSalaryMax(mockJob.salaryMax);
      setCurrency(mockJob.currency);
      setTimeframe(mockJob.timeframe);
      setPipeline(mockJob.pipeline);
      setCollectResume(mockJob.collectResume);
      setCollectCover(mockJob.collectCover);
      setScreeningQuestions(mockJob.screeningQuestions);
      setStages(mockJob.stages);
      setVisibility(mockJob.visibility);
    }
  }, [isEdit]);

  /* ───── autosave ───── */
  useEffect(() => {
    const t = setInterval(() => {
      setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    }, 10000);
    return () => clearInterval(t);
  }, []);

  const handlePublish = () => {
    setStatus("open");
    setPublished(true);
    toast.success("Job published successfully");
  };

  const handleUnpublish = () => {
    setStatus("draft");
    setPublished(false);
    toast.success("Job unpublished");
  };

  const handleSave = () => {
    setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    toast.success("Draft saved");
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText("https://careers.acme.com/jobs/senior-frontend");
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const addQuestion = () => {
    if (newQuestion.trim()) {
      setScreeningQuestions([...screeningQuestions, newQuestion.trim()]);
      setNewQuestion("");
    }
  };

  const removeQuestion = (i: number) => {
    setScreeningQuestions(screeningQuestions.filter((_, idx) => idx !== i));
  };

  const addStage = () => {
    setStages([...stages, { name: "", interviewer: "" }]);
  };

  const removeStage = (i: number) => {
    if (stages.length > 1) setStages(stages.filter((_, idx) => idx !== i));
  };

  const updateStage = (i: number, field: "name" | "interviewer", val: string) => {
    setStages(stages.map((s, idx) => (idx === i ? { ...s, [field]: val } : s)));
  };

  const handleCountryChange = (val: string) => {
    setCountry(val);
    setCity("");
    setCitySearch("");
  };

  /* ───── render helpers ───── */
  const FieldRow = ({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) => (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground/70">{hint}</p>}
    </div>
  );

  /* ───── SECTIONS ───── */
  const renderBasicInfo = () => (
    <div className="space-y-4">
      <FieldRow label="Job Title">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Senior Frontend Engineer"
          className="h-9 text-sm"
        />
      </FieldRow>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FieldRow label="Department">
          <Select value={department} onValueChange={setDepartment}>
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              {["Engineering", "Design", "Marketing", "Sales", "Data", "Operations", "HR"].map((d) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label="Employment Type">
          <Select value={employmentType} onValueChange={setEmploymentType}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["full-time", "part-time", "contract", "internship"].map((t) => (
                <SelectItem key={t} value={t} className="capitalize">{t.replace("-", " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldRow>
      </div>
      <FieldRow label="Workplace Type">
        <div className="flex gap-1.5">
          {(["remote", "hybrid", "onsite"] as const).map((w) => (
            <Button
              key={w}
              type="button"
              variant={workplaceType === w ? "default" : "outline"}
              size="sm"
              className="flex-1 h-9 text-xs capitalize"
              onClick={() => setWorkplaceType(w)}
            >
              {w}
            </Button>
          ))}
        </div>
      </FieldRow>
      {/* Location: Country + City */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FieldRow label="Country">
          <Select value={country} onValueChange={handleCountryChange}>
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select country" /></SelectTrigger>
            <SelectContent>
              {Object.keys(countryCities).map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label="City">
          <Select value={city} onValueChange={setCity} disabled={!country}>
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder={country ? "Select city" : "Select country first"} /></SelectTrigger>
            <SelectContent>
              {/* Simple search within content */}
              <div className="px-2 pb-1.5">
                <Input
                  placeholder="Search city..."
                  value={citySearch}
                  onChange={(e) => setCitySearch(e.target.value)}
                  className="h-7 text-xs"
                />
              </div>
              {filteredCities.length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">No cities found</div>
              ) : (
                filteredCities.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </FieldRow>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FieldRow label="Hiring Manager">
          <Select value={hiringManager} onValueChange={setHiringManager}>
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              {["Jane Doe", "John Smith", "Sarah Lee", "Mike Chen"].map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label="Status">
          <Select value={status} onValueChange={(v) => setStatus(v as JobStatus)}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
      </div>
    </div>
  );

  const renderDescription = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium text-muted-foreground">Job Description</Label>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={() => setAiSheetOpen(true)}
        >
          <Sparkles className="h-3 w-3" /> AI Assist
        </Button>
      </div>
      <TiptapEditor content={description} onChange={setDescription} />
      <p className="text-[11px] text-muted-foreground/70">
        Use AI Assist to generate, improve, shorten, or expand the description.
      </p>
    </div>
  );

  const renderHiringDetails = () => (
    <div className="space-y-5">
      <FieldRow label="Openings">
        <Input
          type="number"
          min={1}
          value={openings}
          onChange={(e) => setOpenings(Number(e.target.value))}
          className="h-9 text-sm max-w-[120px]"
        />
      </FieldRow>

      <Separator />

      {/* Salary Type Selector */}
      <FieldRow label="Salary">
        <div className="flex gap-1.5">
          {([
            { val: "hidden", label: "Not shown" },
            { val: "fixed", label: "Fixed amount" },
            { val: "range", label: "Range" },
          ] as { val: SalaryType; label: string }[]).map((opt) => (
            <Button
              key={opt.val}
              type="button"
              variant={salaryType === opt.val ? "default" : "outline"}
              size="sm"
              className="h-9 text-xs flex-1"
              onClick={() => setSalaryType(opt.val)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </FieldRow>

      {salaryType === "fixed" && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FieldRow label="Amount">
            <Input
              value={salaryFixed}
              onChange={(e) => setSalaryFixed(e.target.value)}
              placeholder="e.g. 150000"
              className="h-9 text-sm"
              type="number"
            />
          </FieldRow>
          <FieldRow label="Currency">
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["USD", "EUR", "GBP", "CAD", "AUD"].map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>
          <FieldRow label="Timeframe">
            <Select value={timeframe} onValueChange={setTimeframe}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["per year", "per month", "per hour"].map((t) => (
                  <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>
        </div>
      )}

      {salaryType === "range" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldRow label="Minimum">
              <Input
                value={salaryMin}
                onChange={(e) => setSalaryMin(e.target.value)}
                placeholder="e.g. 140000"
                className="h-9 text-sm"
                type="number"
              />
            </FieldRow>
            <FieldRow label="Maximum">
              <Input
                value={salaryMax}
                onChange={(e) => setSalaryMax(e.target.value)}
                placeholder="e.g. 180000"
                className="h-9 text-sm"
                type="number"
              />
            </FieldRow>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldRow label="Currency">
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["USD", "EUR", "GBP", "CAD", "AUD"].map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldRow>
            <FieldRow label="Timeframe">
              <Select value={timeframe} onValueChange={setTimeframe}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["per year", "per month", "per hour"].map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldRow>
          </div>
          {salaryMin && salaryMax && Number(salaryMin) > Number(salaryMax) && (
            <p className="text-xs text-destructive">Minimum salary must be less than or equal to maximum.</p>
          )}
        </>
      )}

      <Separator />

      <FieldRow label="Interview Pipeline Template">
        <Select value={pipeline} onValueChange={setPipeline}>
          <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="standard">Standard (4 stages)</SelectItem>
            <SelectItem value="fast">Fast Track (2 stages)</SelectItem>
            <SelectItem value="executive">Executive (6 stages)</SelectItem>
          </SelectContent>
        </Select>
      </FieldRow>

      {salaryType === "range" && salaryMin && salaryMax && Number(salaryMin) <= Number(salaryMax) && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 p-3">
          <Sparkles className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground">
            AI benchmark: Market median for this role is $150k–$175k in {country && city ? `${city}, ${country}` : "the US"}.
          </p>
        </div>
      )}
    </div>
  );

  const renderApplication = () => (
    <div className="space-y-5">
      <div className="flex items-center justify-between py-1">
        <div>
          <p className="text-sm font-medium">Resume</p>
          <p className="text-xs text-muted-foreground">Require candidates to upload a resume</p>
        </div>
        <Switch checked={collectResume} onCheckedChange={setCollectResume} />
      </div>
      <Separator />
      <div className="flex items-center justify-between py-1">
        <div>
          <p className="text-sm font-medium">Cover Letter</p>
          <p className="text-xs text-muted-foreground">Optionally collect a cover letter</p>
        </div>
        <Switch checked={collectCover} onCheckedChange={setCollectCover} />
      </div>
      <Separator />
      <div className="space-y-3">
        <Label className="text-xs font-medium text-muted-foreground">Screening Questions</Label>
        {screeningQuestions.map((q, i) => (
          <div key={i} className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
            <span className="text-sm flex-1">{q}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeQuestion(i)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        <div className="flex gap-2">
          <Input
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            placeholder="Add a screening question..."
            className="h-9 text-sm flex-1"
            onKeyDown={(e) => e.key === "Enter" && addQuestion()}
          />
          <Button variant="outline" size="sm" className="h-9 text-xs shrink-0" onClick={addQuestion}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );

  const renderInterviewPlan = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium text-muted-foreground">Interview Stages</Label>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={addStage}>
          <Plus className="h-3 w-3" /> Add Stage
        </Button>
      </div>
      <div className="space-y-2">
        {stages.map((stage, i) => (
          <div
            key={i}
            className="flex items-center gap-2 rounded-lg border border-border bg-card p-3"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground/50 shrink-0 cursor-grab" />
            <span className="text-xs font-medium text-muted-foreground w-5 shrink-0">{i + 1}</span>
            <Input
              value={stage.name}
              onChange={(e) => updateStage(i, "name", e.target.value)}
              placeholder="Stage name"
              className="h-8 text-sm flex-1"
            />
            <Select value={stage.interviewer} onValueChange={(v) => updateStage(i, "interviewer", v)}>
              <SelectTrigger className="h-8 text-sm w-36 shrink-0">
                <SelectValue placeholder="Interviewer" />
              </SelectTrigger>
              <SelectContent>
                {["Jane Doe", "John Smith", "Sarah Lee", "Mike Chen"].map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {stages.length > 1 && (
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeStage(i)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const renderVisibility = () => (
    <div className="space-y-5">
      <FieldRow label="Job Visibility">
        <div className="space-y-2">
          {([
            { val: "internal", label: "Internal Only", desc: "Only visible to your team" },
            { val: "careers", label: "Careers Page", desc: "Visible on your careers site" },
            { val: "public", label: "Public Link", desc: "Shareable public URL" },
          ] as const).map((opt) => (
            <button
              key={opt.val}
              onClick={() => setVisibility(opt.val)}
              className={cn(
                "w-full flex items-center justify-between rounded-lg border p-3 text-left transition-colors",
                visibility === opt.val
                  ? "border-foreground bg-muted/50"
                  : "border-border hover:bg-muted/30"
              )}
            >
              <div>
                <p className="text-sm font-medium">{opt.label}</p>
                <p className="text-xs text-muted-foreground">{opt.desc}</p>
              </div>
              {visibility === opt.val && (
                <div className="h-4 w-4 rounded-full bg-foreground flex items-center justify-center shrink-0">
                  <Check className="h-2.5 w-2.5 text-background" />
                </div>
              )}
            </button>
          ))}
        </div>
      </FieldRow>

      {published && (
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
          <p className="text-sm font-medium">Shareable Link</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-xs text-muted-foreground truncate">
              https://careers.acme.com/jobs/senior-frontend
            </div>
            <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5 shrink-0" onClick={handleCopyLink}>
              {linkCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {linkCopied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  const sectionRenderers = [
    renderBasicInfo,
    renderDescription,
    renderHiringDetails,
    renderApplication,
    renderInterviewPlan,
    renderVisibility,
  ];

  /* ───── Summary Panel Content ───── */
  const SummaryContent = () => (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-muted-foreground mb-1">Status</p>
        <Badge variant={status === "open" ? "default" : "secondary"} className="capitalize text-xs">
          {status}
        </Badge>
      </div>
      <Separator />
      <div>
        <p className="text-xs text-muted-foreground mb-1">Visibility</p>
        <div className="flex items-center gap-1.5">
          {visibility === "public" ? <Globe className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          <span className="text-sm capitalize">{visibility}</span>
        </div>
      </div>
      <Separator />
      <div>
        <p className="text-xs text-muted-foreground mb-1.5">Hiring Team</p>
        <div className="space-y-1.5">
          {hiringManager && (
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground shrink-0">
                {hiringManager.split(" ").map((n) => n[0]).join("")}
              </div>
              <span className="text-xs">{hiringManager}</span>
            </div>
          )}
          {stages.filter((s) => s.interviewer).map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground shrink-0">
                {s.interviewer.split(" ").map((n) => n[0]).join("")}
              </div>
              <span className="text-xs">{s.interviewer}</span>
              <span className="text-[10px] text-muted-foreground">· {s.name}</span>
            </div>
          ))}
        </div>
      </div>
      <Separator />
      {savedAt && (
        <p className="text-[10px] text-muted-foreground text-center">Saved at {savedAt}</p>
      )}
    </div>
  );

  /* ───── AI Sheet ───── */
  const AiSheet = () => (
    <Sheet open={aiSheetOpen} onOpenChange={setAiSheetOpen}>
      <SheetContent side={isMobile ? "bottom" : "right"} className={isMobile ? "h-[85vh] rounded-t-2xl" : ""}>
        <SheetHeader>
          <SheetTitle className="text-base">AI Writing Assistant</SheetTitle>
          <SheetDescription className="text-xs">Generate or improve your job description with AI.</SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-3">
          {[
            { label: "Generate full description", desc: "Create a complete JD from the job title and details" },
            { label: "Improve tone", desc: "Make the language more professional and inclusive" },
            { label: "Shorten", desc: "Condense the description while keeping key points" },
            { label: "Expand", desc: "Add more detail to responsibilities and requirements" },
            { label: "Add responsibilities section", desc: "Generate a structured list of responsibilities" },
            { label: "Add requirements section", desc: "Generate a structured list of requirements" },
          ].map((action) => (
            <button
              key={action.label}
              onClick={() => {
                toast.success(`AI: "${action.label}" — coming soon`);
                setAiSheetOpen(false);
              }}
              className="w-full flex items-center gap-3 rounded-lg border border-border p-3 text-left hover:bg-muted/50 transition-colors"
            >
              <Sparkles className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-sm font-medium">{action.label}</p>
                <p className="text-xs text-muted-foreground">{action.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );

  /* ───────── MOBILE WIZARD ───────── */
  if (isMobile) {
    return (
      <div className="flex flex-col min-h-[calc(100vh-8rem)]">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => navigate("/jobs")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold truncate">{isEdit ? (title || "Edit Job") : "Create Job"}</h1>
            <p className="text-[10px] text-muted-foreground">
              Step {activeSection + 1} of {sections.length} · {sections[activeSection]}
            </p>
          </div>
          <Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => setSummaryOpen(true)}>
            Summary
          </Button>
        </div>

        {/* Progress */}
        <div className="flex gap-1 mb-5">
          {sections.map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors",
                i <= activeSection ? "bg-foreground" : "bg-border"
              )}
            />
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 pb-4">{sectionRenderers[activeSection]()}</div>

        {/* Bottom bar */}
        <div className="sticky bottom-16 bg-background border-t border-border py-3 flex gap-2 -mx-4 px-4">
          {activeSection > 0 && (
            <Button variant="outline" size="sm" className="h-11 text-sm flex-1" onClick={() => setActiveSection(activeSection - 1)}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Back
            </Button>
          )}
          {activeSection < sections.length - 1 ? (
            <Button size="sm" className="h-11 text-sm flex-1" onClick={() => setActiveSection(activeSection + 1)}>
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button size="sm" className="h-11 text-sm flex-1" onClick={published ? handleSave : handlePublish}>
              {published ? "Save Changes" : "Publish Job"}
            </Button>
          )}
        </div>

        {/* Summary Sheet */}
        <Sheet open={summaryOpen} onOpenChange={setSummaryOpen}>
          <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl">
            <SheetHeader>
              <SheetTitle className="text-base">Job Summary</SheetTitle>
              <SheetDescription className="text-xs">Review details before publishing.</SheetDescription>
            </SheetHeader>
            <div className="mt-4">
              <SummaryContent />
            </div>
          </SheetContent>
        </Sheet>

        <AiSheet />
      </div>
    );
  }

  /* ───────── DESKTOP / TABLET ───────── */
  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate("/jobs")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold">{isEdit ? (title || "Edit Job") : "Create Job"}</h1>
        </div>
        {savedAt && (
          <span className="text-[11px] text-muted-foreground">Saved at {savedAt}</span>
        )}
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleSave}>
          <Save className="h-3.5 w-3.5 mr-1.5" /> Save Draft
        </Button>
        {published ? (
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleUnpublish}>
            Unpublish
          </Button>
        ) : (
          <Button size="sm" className="h-8 text-xs" onClick={handlePublish}>
            Publish Job
          </Button>
        )}
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 mb-6 overflow-x-auto no-scrollbar border-b border-border pb-2">
        {sections.map((s, i) => (
          <button
            key={s}
            onClick={() => setActiveSection(i)}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors",
              "hover:bg-muted text-muted-foreground",
              i === activeSection && "bg-muted text-foreground"
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-6">
        {/* Active tab content only */}
        <Card>
          <CardContent className="p-5 md:p-6">
            <h2 className="text-sm font-semibold mb-4">{sections[activeSection]}</h2>
            {sectionRenderers[activeSection]()}
          </CardContent>
        </Card>

        {/* Summary sidebar (desktop) */}
        <div className="hidden lg:block">
          <div className="sticky top-20">
            <Card>
              <CardContent className="p-5">
                <h3 className="text-sm font-semibold mb-4">Summary</h3>
                <SummaryContent />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Tablet: summary toggle */}
        <div className="lg:hidden fixed bottom-4 right-4 z-30">
          <Button
            size="sm"
            variant="outline"
            className="h-10 rounded-full shadow-md text-xs gap-1.5 bg-background"
            onClick={() => setSummaryOpen(true)}
          >
            <Eye className="h-3.5 w-3.5" /> Summary
          </Button>
        </div>
        <Sheet open={summaryOpen} onOpenChange={setSummaryOpen}>
          <SheetContent side="bottom" className="h-[60vh] rounded-t-2xl lg:hidden">
            <SheetHeader>
              <SheetTitle className="text-base">Job Summary</SheetTitle>
              <SheetDescription className="text-xs">Review details before publishing.</SheetDescription>
            </SheetHeader>
            <div className="mt-4">
              <SummaryContent />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <AiSheet />
    </div>
  );
}
