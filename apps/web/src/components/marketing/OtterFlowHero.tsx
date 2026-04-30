"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Briefcase,
  Calendar,
  CheckCircle2,
  Globe,
  Inbox,
  Mail,
  Search,
  Trophy,
  UserPlus,
} from "lucide-react";

type Source = {
  id: string;
  label: string;
  Icon: typeof Briefcase;
};

type Candidate = {
  id: string;
  name: string;
  role: string;
  initials: string;
  hue: number;
  score: number;
  pass: boolean;
};

const SOURCES: Source[] = [
  { id: "portal", label: "Job Portal", Icon: Briefcase },
  { id: "email", label: "Email", Icon: Mail },
  { id: "manual", label: "Manual", Icon: UserPlus },
  { id: "others", label: "Others", Icon: Globe },
];

const CANDIDATES: Candidate[] = [
  {
    id: "c1",
    name: "Maya Chen",
    role: "Senior Frontend Eng.",
    initials: "MC",
    hue: 250,
    score: 92,
    pass: true,
  },
  {
    id: "c2",
    name: "Jordan Reyes",
    role: "Product Designer",
    initials: "JR",
    hue: 180,
    score: 71,
    pass: false,
  },
  {
    id: "c3",
    name: "Aarav Patel",
    role: "ML Engineer",
    initials: "AP",
    hue: 30,
    score: 88,
    pass: true,
  },
  {
    id: "c4",
    name: "Sofia Almeida",
    role: "Growth PM",
    initials: "SA",
    hue: 320,
    score: 64,
    pass: false,
  },
];

const PIPELINE = [
  { id: "applied", label: "Applied", Icon: Inbox },
  { id: "screening", label: "Screening", Icon: Search },
  { id: "interview", label: "Interview", Icon: Calendar },
  { id: "hired", label: "Hired", Icon: Trophy },
] as const;

const VB = { w: 1000, h: 480 };
const AI = { x: 500, y: 230, r: 92 };

const sourcePoints = SOURCES.map((_, i) => ({
  x: 110,
  y: 60 + i * 115,
}));

const pipelinePoints = PIPELINE.map((_, i) => ({
  x: 890,
  y: 45 + i * 125,
}));

const PHASE = {
  ingest: 3200,
  process: 1800,
  filter: 800,
  pipeline: 3600,
  celebrate: 1100,
  reset: 600,
} as const;

type Phase = keyof typeof PHASE;

function sourceToAiPath(i: number) {
  const s = sourcePoints[i];
  const dy = AI.y - s.y;
  const c1 = { x: s.x + 180, y: s.y };
  const c2 = { x: AI.x - AI.r - 100, y: s.y + dy * 0.5 };
  const end = { x: AI.x - AI.r, y: AI.y };
  return `M ${s.x} ${s.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${end.x} ${end.y}`;
}

function aiToPipelinePath() {
  const start = { x: AI.x + AI.r, y: AI.y };
  const end = pipelinePoints[0];
  const c1 = { x: AI.x + AI.r + 120, y: AI.y };
  const c2 = { x: end.x - 140, y: end.y };
  return `M ${start.x} ${start.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${end.x} ${end.y}`;
}

function usePhase() {
  const [phase, setPhase] = useState<Phase>("ingest");
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const order: Phase[] = ["ingest", "process", "filter", "pipeline", "celebrate", "reset"];

    const run = async () => {
      while (!cancelled) {
        for (const p of order) {
          if (cancelled) return;
          setPhase(p);
          await new Promise((resolve) => setTimeout(resolve, PHASE[p]));
        }
        setCycle((value) => value + 1);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  return { phase, cycle };
}

function SourceNode({ source, index, active }: { source: Source; index: number; active: boolean }) {
  const { Icon } = source;

  return (
    <foreignObject
      x={sourcePoints[index].x - 95}
      y={sourcePoints[index].y - 26}
      width={150}
      height={52}
    >
      <motion.div
        animate={{
          scale: active ? 1.04 : 1,
          boxShadow: active
            ? "0 8px 24px -8px rgba(15, 23, 42, 0.15)"
            : "0 2px 6px -2px rgba(15, 23, 42, 0.08)",
        }}
        transition={{ duration: 0.35 }}
        className="flex h-full w-full items-center gap-2.5 rounded-xl border border-black/8 bg-white/80 px-3 backdrop-blur-md"
      >
        <motion.div
          animate={{
            backgroundColor: active ? "rgba(15, 23, 42, 0.07)" : "rgba(226, 232, 240, 0.85)",
          }}
          className="flex h-8 w-8 items-center justify-center rounded-lg"
        >
          <Icon size={16} className={active ? "text-slate-900" : "text-slate-500"} />
        </motion.div>
        <div className="min-w-0">
          <div className="truncate text-[12px] font-medium text-slate-900">{source.label}</div>
          <div className="text-[10px] text-slate-500">Live</div>
        </div>
        <motion.span
          animate={{ opacity: active ? 1 : 0.25, scale: active ? [1, 1.4, 1] : 1 }}
          transition={{ duration: 0.6, repeat: active ? Infinity : 0 }}
          className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-400"
        />
      </motion.div>
    </foreignObject>
  );
}

function FlowArrow({
  d,
  active,
  delay = 0,
  reverse = false,
}: {
  d: string;
  active: boolean;
  delay?: number;
  reverse?: boolean;
}) {
  return (
    <g>
      <path
        d={d}
        fill="none"
        stroke="rgba(148, 163, 184, 0.28)"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <motion.path
        d={d}
        fill="none"
        stroke="rgba(15, 23, 42, 0.8)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray="6 10"
        initial={{ strokeDashoffset: 0, opacity: 0 }}
        animate={{
          strokeDashoffset: active ? (reverse ? 320 : -320) : 0,
          opacity: active ? 1 : 0,
        }}
        transition={{
          strokeDashoffset: {
            duration: 2.4,
            repeat: active ? Infinity : 0,
            ease: "linear",
            delay,
          },
          opacity: { duration: 0.4, delay },
        }}
      />
    </g>
  );
}

function MiniCandidate({ candidate }: { candidate: Candidate }) {
  const w = 168;
  const h = 44;

  return (
    <foreignObject x={-w / 2} y={-h / 2} width={w} height={h}>
      <div className="flex h-full w-full items-center gap-2 rounded-xl border border-white/60 bg-white/72 px-2.5 shadow-[0_8px_20px_-10px_rgba(15,23,42,0.25)] backdrop-blur-md">
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
          style={{
            background: `linear-gradient(135deg, hsl(${candidate.hue} 80% 60%), hsl(${(candidate.hue + 40) % 360} 80% 55%))`,
          }}
        >
          {candidate.initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[11px] font-medium leading-tight text-slate-900">
            {candidate.name}
          </div>
          <div className="truncate text-[9.5px] leading-tight text-slate-500">{candidate.role}</div>
        </div>
      </div>
    </foreignObject>
  );
}

function TravelingCard({
  candidate,
  pathD,
  active,
  delay,
  duration,
}: {
  candidate: Candidate;
  pathD: string;
  active: boolean;
  delay: number;
  duration: number;
}) {
  return (
    <AnimatePresence>
      {active ? (
        <motion.g
          key={candidate.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, delay }}
        >
          <motion.g
            initial={{ offsetDistance: "0%" } as never}
            animate={{ offsetDistance: "100%" } as never}
            transition={{ duration, delay, ease: "easeInOut" }}
            style={
              {
                offsetPath: `path('${pathD}')`,
                offsetRotate: "0deg",
              } as React.CSSProperties
            }
          >
            <MiniCandidate candidate={candidate} />
          </motion.g>
        </motion.g>
      ) : null}
    </AnimatePresence>
  );
}

function OtterHub({ phase, topScore }: { phase: Phase; topScore: number }) {
  const processing = phase === "process";
  const filtering = phase === "filter";
  const active = processing || filtering;
  const particles = Array.from({ length: 10 }, (_, i) => i);

  return (
    <g>
      {/* Circular glow — SVG circle with blur filter so it stays round, not clipped by foreignObject */}
      <motion.circle
        cx={AI.x}
        cy={AI.y}
        r={68}
        fill="rgba(15, 23, 42, 0.09)"
        filter="url(#hub-glow)"
        animate={{
          r: active ? [68, 76, 68] : [62, 68, 62],
          opacity: active ? [0.55, 0.25, 0.55] : [0.3, 0.18, 0.3],
        }}
        transition={{ duration: active ? 1.8 : 3.2, repeat: Infinity, ease: "easeInOut" }}
      />

      <AnimatePresence>
        {active
          ? [0, 0.6, 1.2].map((delay, i) => (
              <motion.circle
                key={`ripple-${i}-${phase}`}
                cx={AI.x}
                cy={AI.y}
                r={70}
                fill="none"
                stroke="rgba(15, 23, 42, 0.35)"
                strokeWidth={1.2}
                initial={{ opacity: 0.6, scale: 0.6 }}
                animate={{ opacity: 0, scale: 1.8 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut", delay }}
                style={{ transformOrigin: `${AI.x}px ${AI.y}px` }}
              />
            ))
          : null}
      </AnimatePresence>

      <AnimatePresence>
        {processing
          ? particles.map((i) => {
              const angle = (i / particles.length) * Math.PI * 2;
              const r = 95;
              const px = AI.x + Math.cos(angle) * r;
              const py = AI.y + Math.sin(angle) * r;
              return (
                <motion.circle
                  key={`p-${i}`}
                  cx={px}
                  cy={py}
                  r={2}
                  fill="rgba(15, 23, 42, 0.6)"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: [0, 1, 0], scale: [0, 1, 0] }}
                  exit={{ opacity: 0 }}
                  transition={{
                    duration: 1.6,
                    repeat: Infinity,
                    delay: i * 0.12,
                    ease: "easeInOut",
                  }}
                />
              );
            })
          : null}
      </AnimatePresence>

      {/* Hub circle — transparent container so foreignObject doesn't render a white rectangle */}
      <foreignObject
        x={AI.x - AI.r}
        y={AI.y - AI.r}
        width={AI.r * 2}
        height={AI.r * 2}
        style={{ overflow: "visible" }}
      >
        <div
          className="flex h-full w-full items-center justify-center"
          style={{ background: "transparent" }}
        >
          <motion.div
            animate={{
              scale: [1, 1.04, 1],
              boxShadow: active
                ? "0 0 60px -5px rgba(15, 23, 42, 0.18), inset 0 0 0 1px rgba(15, 23, 42, 0.14)"
                : "0 0 40px -10px rgba(15, 23, 42, 0.1), inset 0 0 0 1px rgba(15, 23, 42, 0.08)",
            }}
            transition={{
              scale: { duration: 3.2, repeat: Infinity, ease: "easeInOut" },
              boxShadow: { duration: 0.5 },
            }}
            className="relative flex h-full w-full flex-col items-center justify-center rounded-full bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.98),rgba(248,250,252,0.96)_60%,rgba(241,245,249,0.94)_100%)]"
          >
            <motion.div
              animate={{ rotate: active ? 360 : 0 }}
              transition={{ duration: 6, repeat: active ? Infinity : 0, ease: "linear" }}
              className="absolute inset-2 rounded-full border border-dashed border-[rgba(15,23,42,0.18)]"
            />

            {/* Logo centered directly — no card wrapper */}
            <motion.img
              src="/brand/hero.png"
              alt="Otter Hire"
              className="h-12 w-auto object-contain"
              animate={{ scale: active ? [1, 1.08, 1] : 1 }}
              transition={{ duration: 1.4, repeat: active ? Infinity : 0, ease: "easeInOut" }}
            />

            <div className="mt-2 text-[9.5px] uppercase tracking-[0.12em] text-slate-500">
              {active ? "Processing" : "Idle"}
            </div>
          </motion.div>
        </div>
      </foreignObject>

      {/* Badge — own foreignObject outside the hub's bounds so it never gets clipped */}
      <AnimatePresence>
        {active ? (
          <motion.g
            key="match-badge"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            <foreignObject x={AI.x + 8} y={AI.y - AI.r - 26} width={120} height={28}>
              <div className="flex h-full w-full items-center">
                <div className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50/90 px-2 py-0.5 shadow-sm backdrop-blur-sm whitespace-nowrap">
                  <span className="h-1 w-1 shrink-0 rounded-full bg-emerald-500" />
                  <span className="text-[9.5px] font-semibold text-emerald-600">
                    {topScore}% match
                  </span>
                </div>
              </div>
            </foreignObject>
          </motion.g>
        ) : null}
      </AnimatePresence>
    </g>
  );
}

function PipelineStage({
  index,
  label,
  Icon,
  activeIndex,
  celebrate,
}: {
  index: number;
  label: string;
  Icon: typeof Inbox;
  activeIndex: number;
  celebrate: boolean;
}) {
  const isActive = activeIndex === index;
  const isPast = activeIndex > index;
  const isHired = index === PIPELINE.length - 1;
  const highlight = isActive || (celebrate && isHired);

  return (
    <foreignObject
      x={pipelinePoints[index].x - 55}
      y={pipelinePoints[index].y - 30}
      width={155}
      height={60}
    >
      <motion.div
        animate={{
          borderColor: highlight
            ? "rgba(15, 23, 42, 0.7)"
            : isPast
              ? "rgba(16, 185, 129, 0.5)"
              : "rgba(15, 23, 42, 0.08)",
          backgroundColor: highlight ? "rgba(15, 23, 42, 0.06)" : "rgba(255, 255, 255, 0.72)",
        }}
        transition={{ duration: 0.35 }}
        className="relative flex h-full w-full items-center gap-2.5 rounded-xl border px-3 backdrop-blur-md"
      >
        <motion.div
          animate={{
            backgroundColor:
              celebrate && isHired
                ? "rgb(16 185 129)"
                : highlight
                  ? "rgb(15 23 42)"
                  : isPast
                    ? "rgba(16, 185, 129, 0.15)"
                    : "rgba(241, 245, 249, 0.9)",
            color:
              celebrate && isHired
                ? "rgb(255 255 255)"
                : highlight
                  ? "rgb(255 255 255)"
                  : isPast
                    ? "rgb(16 185 129)"
                    : "rgb(100 116 139)",
          }}
          transition={{ duration: 0.3 }}
          className="flex h-8 w-8 items-center justify-center rounded-lg"
        >
          {celebrate && isHired ? <CheckCircle2 size={16} /> : <Icon size={16} />}
        </motion.div>
        <div className="min-w-0">
          <div className="text-[11px] font-medium text-slate-900">{label}</div>
          <div className="text-[9.5px] text-slate-500">
            {isPast ? "Done" : highlight ? "In progress" : "Waiting"}
          </div>
        </div>

        <AnimatePresence>
          {celebrate && isHired ? (
            <motion.div
              key="glow"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: [0, 0.6, 0], scale: [0.8, 1.4, 1.6] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1, repeat: Infinity }}
              className="pointer-events-none absolute inset-0 -z-10 rounded-xl bg-emerald-300/30 blur-xl"
            />
          ) : null}
        </AnimatePresence>
      </motion.div>
    </foreignObject>
  );
}

export default function OtterFlowHero() {
  const { phase, cycle } = usePhase();
  const [topScore, setTopScore] = useState(0);
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    if (phase === "ingest") {
      setTopScore(0);
      return;
    }

    if (phase === "process") {
      let raf = 0;
      const start = performance.now();
      const tick = (t: number) => {
        const progress = Math.min(1, (t - start) / PHASE.process);
        setTopScore(Math.round(progress * 92));
        if (progress < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }

    if (phase === "filter" || phase === "pipeline" || phase === "celebrate") {
      setTopScore(92);
    }
  }, [phase, cycle]);

  useEffect(() => {
    if (phase !== "pipeline") {
      if (phase === "ingest") setStageIndex(-1);
      if (phase === "celebrate") setStageIndex(PIPELINE.length - 1);
      return;
    }

    setStageIndex(0);
    const step = PHASE.pipeline / PIPELINE.length;
    const timers = PIPELINE.map((_, i) => setTimeout(() => setStageIndex(i), i * step));
    return () => timers.forEach(clearTimeout);
  }, [phase, cycle]);

  const ingestActive = phase === "ingest";
  const pipelineFlowActive = phase === "filter" || phase === "pipeline";
  const aiPath = aiToPipelinePath();
  const winner = CANDIDATES.find((candidate) => candidate.pass) ?? CANDIDATES[0];

  return (
    <div className="relative mx-auto w-full max-w-[1280px]">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-20 top-10 h-80 w-80 rounded-full bg-[rgba(15,23,42,0.04)] blur-3xl" />
        <div className="absolute -right-12 bottom-8 h-72 w-72 rounded-full bg-[rgba(15,23,42,0.03)] blur-3xl" />
      </div>

      <div className="rounded-[34px] border border-black/8 bg-white/48 p-3 shadow-[0_28px_80px_rgba(15,23,42,0.08)] backdrop-blur-[10px] sm:p-5">
        <svg
          viewBox={`0 0 ${VB.w} ${VB.h}`}
          className="block h-auto w-full"
          role="img"
          aria-label="Otter ATS workflow animation"
        >
          <defs>
            {/* Gaussian blur filter for the hub glow — keeps it perfectly circular */}
            <filter id="hub-glow" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="18" />
            </filter>
          </defs>
          {SOURCES.map((_, i) => (
            <FlowArrow
              key={`arr-${i}`}
              d={sourceToAiPath(i)}
              active={ingestActive}
              delay={i * 0.25}
            />
          ))}

          <FlowArrow d={aiPath} active={pipelineFlowActive || phase === "celebrate"} />

          {SOURCES.map((source, i) => (
            <SourceNode key={source.id} source={source} index={i} active={ingestActive} />
          ))}

          {CANDIDATES.map((candidate, i) => (
            <TravelingCard
              key={`${candidate.id}-${cycle}-in`}
              candidate={candidate}
              pathD={sourceToAiPath(i)}
              active={ingestActive}
              delay={0.15 + i * 0.35}
              duration={2.2}
            />
          ))}

          <OtterHub phase={phase} topScore={topScore} />

          <AnimatePresence>
            {phase === "pipeline" ? (
              <motion.g
                key={`winner-${cycle}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.g
                  initial={{ offsetDistance: "0%" } as never}
                  animate={{ offsetDistance: "100%" } as never}
                  transition={{ duration: 1.1, ease: "easeInOut" }}
                  style={{ offsetPath: `path('${aiPath}')` } as React.CSSProperties}
                >
                  <MiniCandidate candidate={winner} />
                </motion.g>
              </motion.g>
            ) : null}
          </AnimatePresence>

          {PIPELINE.map((item, i) => (
            <PipelineStage
              key={item.id}
              index={i}
              label={item.label}
              Icon={item.Icon}
              activeIndex={stageIndex}
              celebrate={phase === "celebrate"}
            />
          ))}
        </svg>
      </div>
    </div>
  );
}
