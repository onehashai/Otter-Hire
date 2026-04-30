"use client";

import Image from "next/image";
import { ArrowRight, Check, ChevronDown, MousePointerClick } from "lucide-react";
import { useState } from "react";
import OtterFlowHero from "@/components/marketing/OtterFlowHero";
import MarketingNav from "@/components/marketing/MarketingNav";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import { useScrollReveal } from "@/hooks/useScrollReveal";

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

const TRUST_LOGOS = [
  { src: "/marketing/logos/onehash.png", alt: "OneHash" },
  { src: "/marketing/logos/capitalvia.png", alt: "CapitalVia" },
  { src: "/marketing/logos/nivesta.png", alt: "Nivesta Capital" },
  { src: "/marketing/logos/bellcurve.png", alt: "Bellcurve Broking" },
  { src: "/marketing/logos/finofy.png", alt: "FinoFY" },
];
// Duplicate for seamless infinite loop
const MARQUEE_LOGOS = [...TRUST_LOGOS, ...TRUST_LOGOS];

const faqs = [
  {
    q: "Is Otter Hire really free?",
    a: "Yes, completely. Otter Hire is open source — you can self-host it, inspect the code, and use every feature without a subscription or credit card. There are no paid tiers, no feature gates, and no usage limits imposed by us.",
  },
  {
    q: "How does AI resume screening work?",
    a: "When a resume is uploaded or received via inbound email, Otter Hire parses it automatically — extracting skills, experience, education, and certifications. Each candidate is scored against the job requirements so your team sees the strongest applicants first, before anyone opens a single PDF.",
  },
  {
    q: "Can I customize pipeline stages for each job?",
    a: "Yes. Every job in Otter Hire has its own independent pipeline. You can add, rename, reorder, or remove stages to match your exact hiring process — whether that's a 3-step screen or a 7-stage enterprise loop.",
  },
  {
    q: "What file formats does resume upload support?",
    a: "Otter Hire supports PDF and DOCX/DOC uploads. PDFs are previewed natively in-browser; DOCX files are converted to HTML for inline viewing. Both formats go through the same AI parsing pipeline.",
  },
  {
    q: "How does workflow automation work?",
    a: "You build automations in a visual trigger → action editor. Set a trigger (e.g. candidate moves to Interview stage) and attach actions (e.g. send a confirmation email using a template). Automations run automatically in the background and every execution is logged for audit.",
  },
  {
    q: "Can multiple recruiters and hiring managers collaborate?",
    a: "Yes. Otter Hire is built for teams. You can invite members with role-based permissions — owner, admin, recruiter, hiring manager, interviewer, or employee. Each role sees the right context without cluttering their view with irrelevant controls.",
  },
  {
    q: "Does Otter Hire integrate with our existing email?",
    a: "Yes. You can connect your SMTP credentials for outbound email, and each job can have a dedicated inbound email address. Resumes sent to that address are automatically parsed and a candidate record is created — no manual upload needed.",
  },
  {
    q: "How is candidate data stored and kept secure?",
    a: "All data is stored in a private PostgreSQL database scoped to your organisation. Files are stored in S3 with environment-isolated prefixes. Access requires a valid JWT session and all API routes enforce role-based permission checks.",
  },
];

const productRows = [
  {
    kicker: "Hiring pipeline",
    title: "Every open role, fully organized",
    copy: "",
    checks: [
      "Post jobs in minutes with AI-written descriptions",
      "Drag-and-drop pipeline stages per role",
      "Real-time applicant counts across every stage",
    ],
    ctaLabel: "Manage Pipeline",
    ctaPath: "/jobs",
    img: "/marketing/product/pipeline.png",
    imgAlt: "Otter Hire jobs page",
    flip: false,
  },
  {
    kicker: "Workflow automation",
    title: "Stop doing the same manual tasks twice",
    copy: "",
    checks: [
      "Auto-send emails when a candidate moves stage",
      "Assign reviewers without manual handoffs",
      "Full execution log so nothing falls through",
    ],
    ctaLabel: "Automate Hiring",
    ctaPath: "/automations",
    img: "/marketing/product/automations.png",
    imgAlt: "Otter Hire automations page",
    flip: true,
  },
  {
    kicker: "Email templates",
    title: "Every candidate message, on-brand and ready",
    copy: "",
    checks: [
      "Rich-text editor with dynamic variables",
      "Reuse across automations and manual sends",
      "Consistent voice across every recruiter on the team",
    ],
    ctaLabel: "Build Templates",
    ctaPath: "/templates",
    img: "/marketing/product/templates.png",
    imgAlt: "Otter Hire templates page",
    flip: false,
  },
];

function FaqAccordion() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="divide-y divide-slate-100">
      {faqs.map((faq, i) => (
        <div key={i}>
          <button
            type="button"
            onClick={() => setOpen(open === i ? null : i)}
            className="flex w-full items-center justify-between gap-6 py-5 text-left"
          >
            <span className="text-base font-semibold text-slate-900 sm:text-lg">{faq.q}</span>
            <ChevronDown
              className={`h-5 w-5 shrink-0 text-slate-400 transition-transform duration-300 ${open === i ? "rotate-180" : ""}`}
            />
          </button>
          <div
            className={`overflow-hidden transition-all duration-300 ease-in-out ${open === i ? "max-h-96 pb-5" : "max-h-0"}`}
          >
            <p className="text-base leading-7 text-slate-600">{faq.a}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function MarketingPage() {
  useScrollReveal();

  function handleProductCta(_path: string) {
    window.open("/signup", "_blank", "noopener,noreferrer");
  }

  return (
    <main
      id="top"
      className="marketing-root min-h-screen overflow-x-clip bg-background text-foreground"
    >
      <MarketingNav />

      <section className="marketing-hero-section">
        <div className="marketing-cloud marketing-cloud-left" />
        <div className="marketing-cloud marketing-cloud-right" />
        <div className="mx-auto max-w-6xl px-4 pt-28 sm:px-6 sm:pt-32">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="marketing-display reveal" data-delay="90">
              Recruit top talent faster and smarter
            </h1>
            <p className="marketing-subcopy reveal" data-delay="180">
              AI-powered, open source modern ATS to recruit top talent faster and smarter.
            </p>
            <div
              className="reveal mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row"
              data-delay="260"
            >
              <a
                href="/signup"
                target="_blank"
                rel="noopener noreferrer"
                className="marketing-button marketing-button-primary"
              >
                Try Otter Hire
                <ArrowRight className="h-4 w-4" />
              </a>
              <button
                type="button"
                onClick={() => scrollToSection("product")}
                className="marketing-button marketing-button-secondary"
              >
                Explore the product
              </button>
            </div>
          </div>

          <div className="reveal mt-10 sm:mt-12" data-delay="340">
            <OtterFlowHero />
          </div>
        </div>
      </section>

      <section className="bg-[linear-gradient(180deg,#ffffff_0%,#fbfbfd_100%)] py-14">
        <p className="reveal text-center text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400 mb-10">
          Trusted by fast-growing teams
        </p>
        <div className="mx-auto max-w-4xl relative overflow-hidden">
          {/* Fade edges */}
          <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-20 z-10 bg-gradient-to-r from-white to-transparent" />
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-20 z-10 bg-gradient-to-l from-white to-transparent" />
          <div
            className="flex items-center gap-16 w-max"
            style={{ animation: "marquee-scroll 28s linear infinite" }}
          >
            {MARQUEE_LOGOS.map((logo, i) => (
              <div
                key={i}
                className="shrink-0 opacity-50 grayscale hover:opacity-80 hover:grayscale-0 transition-all duration-300"
              >
                <Image
                  src={logo.src}
                  alt={logo.alt}
                  width={160}
                  height={48}
                  className="h-11 w-auto object-contain"
                  priority={i < 5}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="product" className="bg-white py-24 sm:py-32 overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          {/* intro */}
          <div className="mx-auto max-w-4xl text-center reveal mb-24">
            <p className="marketing-section-kicker">The product</p>
            <h2 className="marketing-section-title">
              Everything your hiring team needs, nothing it doesn&apos;t
            </h2>
          </div>

          {/* alternating rows */}
          <div className="flex flex-col gap-32">
            {productRows.map((row, i) => (
              <div
                key={row.kicker}
                className={`reveal grid items-center gap-10 lg:gap-16 ${row.flip ? "lg:grid-cols-[8fr_5fr]" : "lg:grid-cols-[5fr_8fr]"}`}
                data-delay={i * 80}
              >
                {/* text */}
                <div className={row.flip ? "lg:order-2" : ""}>
                  <p className="marketing-section-kicker">{row.kicker}</p>
                  <h3 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-[2.4rem] sm:leading-tight">
                    {row.title}
                  </h3>
                  <ul className="mt-7 space-y-3">
                    {row.checks.map((check) => (
                      <li key={check} className="marketing-check-row">
                        <span className="marketing-check-icon">
                          <Check className="h-4 w-4" />
                        </span>
                        <span>{check}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => handleProductCta(row.ctaPath)}
                    className="mt-8 inline-flex items-center gap-2.5 rounded-full bg-black px-6 py-3 text-sm font-semibold text-white shadow-[0_4px_24px_rgba(0,0,0,0.22)] transition-all duration-200 hover:bg-zinc-800 hover:shadow-[0_6px_32px_rgba(0,0,0,0.32)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
                  >
                    <MousePointerClick className="h-4 w-4 text-white/80" />
                    {row.ctaLabel}
                  </button>
                </div>

                {/* screenshot — dominant, slightly bleeds on large screens */}
                <div
                  className={`${row.flip ? "lg:order-1" : ""} group rounded-2xl overflow-hidden border-2 border-slate-200/80 shadow-[0_32px_80px_rgba(15,23,42,0.14)]`}
                >
                  <Image
                    src={row.img}
                    alt={row.imgAlt}
                    width={1440}
                    height={900}
                    className="w-full h-auto block scale-[1.08] group-hover:scale-[1.03] transition-transform duration-700 ease-out origin-top"
                    priority={i === 0}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="bg-[#f7f8fc] py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-16 lg:grid-cols-[1fr_1.6fr] lg:gap-24 lg:items-start">
            {/* sticky left label */}
            <div className="reveal lg:sticky lg:top-32">
              <p className="marketing-section-kicker">FAQ</p>
              <h2 className="marketing-section-title max-w-xs mt-3">Questions &amp; answers</h2>
              <p className="marketing-section-copy mt-4 max-w-xs">
                Everything you need to know before you get started. Can&apos;t find your answer?{" "}
                <a
                  href="mailto:support@otter.bz"
                  className="underline underline-offset-2 hover:text-slate-900 transition-colors"
                >
                  Reach out
                </a>
                .
              </p>
            </div>

            {/* accordion */}
            <div className="reveal" data-delay="80">
              <FaqAccordion />
            </div>
          </div>
        </div>
      </section>

      <section
        id="contact"
        className="marketing-hero-section border-t border-black/6 py-10 sm:py-14"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="reveal mx-auto max-w-4xl text-center">
            <p className="marketing-section-kicker">Ready to start</p>
            <h2 className="marketing-section-title mx-auto max-w-3xl">Ready to Hire Talent.</h2>
            <p className="marketing-section-copy mx-auto max-w-2xl">
              Launch a cleaner hiring experience for recruiters, hiring managers, and candidates
              without changing your existing product positioning.
            </p>
            <div className="mt-8 flex justify-center">
              <a
                href="/signup"
                target="_blank"
                rel="noopener noreferrer"
                className="marketing-button marketing-button-primary"
              >
                Start Hiring
              </a>
            </div>
          </div>

          <div className="mt-20 sm:mt-28">
            <MarketingFooter />
          </div>
        </div>
      </section>
    </main>
  );
}
