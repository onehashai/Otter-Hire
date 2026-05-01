"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

type Phase = "ingest" | "process" | "filter" | "pipeline" | "celebrate" | "reset";

type LEl = ["path" | "rect" | "circle" | "line" | "polyline", Record<string, string>];

const I_BRIEFCASE: LEl[] = [
  ["path", { d: "M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" }],
  ["rect", { x: "2", y: "6", width: "20", height: "14", rx: "2" }],
];
const I_MAIL: LEl[] = [
  ["rect", { x: "2", y: "4", width: "20", height: "16", rx: "2" }],
  ["path", { d: "m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" }],
];
const I_USERPLUS: LEl[] = [
  ["path", { d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" }],
  ["circle", { cx: "9", cy: "7", r: "4" }],
  ["line", { x1: "19", y1: "8", x2: "19", y2: "14" }],
  ["line", { x1: "22", y1: "11", x2: "16", y2: "11" }],
];
const I_GLOBE: LEl[] = [
  ["circle", { cx: "12", cy: "12", r: "10" }],
  ["path", { d: "M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" }],
  ["path", { d: "M2 12h20" }],
];
const I_INBOX: LEl[] = [
  ["polyline", { points: "22 12 16 12 14 15 10 15 8 12 2 12" }],
  [
    "path",
    {
      d: "M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z",
    },
  ],
];
const I_SEARCH: LEl[] = [
  ["circle", { cx: "11", cy: "11", r: "8" }],
  ["path", { d: "m21 21-4.3-4.3" }],
];
const I_CALENDAR: LEl[] = [
  ["path", { d: "M8 2v4" }],
  ["path", { d: "M16 2v4" }],
  ["rect", { x: "3", y: "4", width: "18", height: "18", rx: "2" }],
  ["path", { d: "M3 10h18" }],
];
const I_TROPHY: LEl[] = [
  ["path", { d: "M6 9H4.5a2.5 2.5 0 0 1 0-5H6" }],
  ["path", { d: "M18 9h1.5a2.5 2.5 0 0 0 0-5H18" }],
  ["path", { d: "M4 22h16" }],
  ["path", { d: "M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" }],
  ["path", { d: "M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" }],
  ["path", { d: "M18 2H6v7a6 6 0 0 0 12 0V2Z" }],
];

function LucideIcon({
  els,
  cx,
  cy,
  size,
  color,
}: {
  els: LEl[];
  cx: number;
  cy: number;
  size: number;
  color: string;
}) {
  const s = size / 24;
  return (
    <g
      transform={`translate(${cx - size / 2},${cy - size / 2}) scale(${s})`}
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {els.map((el, i) => {
        const [tag, a] = el;
        if (tag === "path") return <path key={i} d={a.d} />;
        if (tag === "rect")
          return <rect key={i} x={a.x} y={a.y} width={a.width} height={a.height} rx={a.rx} />;
        if (tag === "circle") return <circle key={i} cx={a.cx} cy={a.cy} r={a.r} />;
        if (tag === "line") return <line key={i} x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} />;
        if (tag === "polyline") return <polyline key={i} points={a.points} />;
        return null;
      })}
    </g>
  );
}

const SOURCES = [
  { id: "portal", label: "Job Portal", icon: I_BRIEFCASE },
  { id: "email", label: "Email", icon: I_MAIL },
  { id: "manual", label: "Manual", icon: I_USERPLUS },
  { id: "others", label: "Others", icon: I_GLOBE },
];

const PIPELINE = [
  { id: "applied", label: "Applied", icon: I_INBOX },
  { id: "screening", label: "Screening", icon: I_SEARCH },
  { id: "interview", label: "Interview", icon: I_CALENDAR },
  { id: "hired", label: "Hired", icon: I_TROPHY },
];

const CANDIDATES = [
  { id: "c1", name: "Maya Chen", role: "Sr. Frontend Eng.", initials: "MC", hue: 250, pass: true },
  {
    id: "c2",
    name: "Jordan Reyes",
    role: "Product Designer",
    initials: "JR",
    hue: 180,
    pass: false,
  },
  { id: "c3", name: "Aarav Patel", role: "ML Engineer", initials: "AP", hue: 30, pass: true },
  { id: "c4", name: "Sofia Almeida", role: "Growth PM", initials: "SA", hue: 320, pass: false },
];

const PHASE_MS = {
  ingest: 3200,
  process: 1800,
  filter: 800,
  pipeline: 4700,
  celebrate: 1100,
  reset: 600,
} as const;

const VB = { w: 1000, h: 480 };
const AI = { x: 500, y: 240, r: 92 };
const srcPts = SOURCES.map((_, i) => ({ x: 110, y: 60 + i * 110 }));
const pipePts = PIPELINE.map((_, i) => ({ x: 890, y: 45 + i * 125 }));

function srcPath(i: number) {
  const s = srcPts[i];
  const dy = AI.y - s.y;
  return `M${s.x},${s.y} C${s.x + 180},${s.y} ${AI.x - AI.r - 100},${s.y + dy * 0.5} ${AI.x - AI.r},${AI.y}`;
}
function aiToPipePath() {
  const sx = AI.x + AI.r,
    sy = AI.y,
    ex = pipePts[0].x,
    ey = pipePts[0].y;
  return `M${sx},${sy} C${sx + 120},${sy} ${ex - 140},${ey} ${ex},${ey}`;
}

// Sample a point along an SVG path string at progress t (0–1)
function samplePath(d: string, t: number): { x: number; y: number } {
  if (typeof document === "undefined") return { x: 0, y: 0 };
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", d);
  const len = path.getTotalLength();
  const pt = path.getPointAtLength(t * len);
  return { x: pt.x, y: pt.y };
}

function usePhase() {
  const [phase, setPhase] = useState<Phase>("ingest");
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    let dead = false;
    const order: Phase[] = ["ingest", "process", "filter", "pipeline", "celebrate", "reset"];
    (async () => {
      while (!dead) {
        for (const p of order) {
          if (dead) return;
          setPhase(p);
          await new Promise((r) => setTimeout(r, PHASE_MS[p]));
        }
        setCycle((c) => c + 1);
      }
    })();
    return () => {
      dead = true;
    };
  }, []);
  return { phase, cycle };
}

// Animates a card along a path using JS-sampled points — no offsetPath, no animateMotion
function PathCard({
  candidate,
  pathD,
  active,
  delay,
  duration,
  lingerMs = 0,
}: {
  candidate: (typeof CANDIDATES)[0];
  pathD: string;
  active: boolean;
  delay: number;
  duration: number;
  lingerMs?: number;
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [visible, setVisible] = useState(false);
  const [opacity, setOpacity] = useState(1);
  const rafRef = useRef<number>(0);
  const posRef = useRef<{ x: number; y: number } | null>(null);
  const visibleRef = useRef(false);
  const lingerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!active) {
      cancelAnimationFrame(rafRef.current);

      if (posRef.current && lingerMs > 0 && visibleRef.current) {
        lingerRef.current = setTimeout(() => {
          setOpacity(0);
          lingerRef.current = setTimeout(() => {
            setVisible(false);
            visibleRef.current = false;
            setPos(null);
            posRef.current = null;
            setOpacity(1);
            lingerRef.current = null;
          }, 300);
        }, lingerMs);
        return () => {
          if (lingerRef.current) clearTimeout(lingerRef.current);
        };
      }

      setVisible(false);
      visibleRef.current = false;
      setPos(null);
      posRef.current = null;
      return;
    }

    if (lingerRef.current) {
      clearTimeout(lingerRef.current);
      lingerRef.current = null;
    }
    setOpacity(1);

    const startTime = performance.now() + delay * 1000;
    let started = false;

    const tick = (now: number) => {
      if (now < startTime) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      if (!started) {
        started = true;
        setVisible(true);
        visibleRef.current = true;
      }
      const elapsed = now - startTime;
      const t = Math.min(elapsed / (duration * 1000), 1);
      // ease in-out cubic
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const pt = samplePath(pathD, eased);
      setPos(pt);
      posRef.current = pt;
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active, pathD, delay, duration, lingerMs]);

  if (!visible || !pos) return null;

  const w = 160,
    h = 42;
  const x = pos.x - w / 2;
  const y = pos.y - h / 2;
  const fg = `hsl(${candidate.hue} 80% 60%)`;
  const fg2 = `hsl(${(candidate.hue + 40) % 360} 80% 55%)`;

  return (
    <g style={{ opacity, transition: "opacity 0.3s ease" }}>
      <defs>
        <linearGradient id={`av-${candidate.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={fg} />
          <stop offset="100%" stopColor={fg2} />
        </linearGradient>
      </defs>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={10}
        ry={10}
        fill="rgba(255,255,255,0.55)"
        stroke="rgba(255,255,255,0.6)"
        strokeWidth={1}
      />
      <circle cx={x + 22} cy={pos.y} r={13} fill={`url(#av-${candidate.id})`} />
      <text
        x={x + 22}
        y={pos.y + 4}
        textAnchor="middle"
        fontSize={9}
        fontWeight={600}
        fill="#fff"
        fontFamily="Inter,sans-serif"
      >
        {candidate.initials}
      </text>
      <text
        x={x + 42}
        y={pos.y - 5}
        fontSize={11}
        fontWeight={500}
        fill="#0f172a"
        fontFamily="Inter,sans-serif"
      >
        {candidate.name}
      </text>
      <text x={x + 42} y={pos.y + 9} fontSize={9} fill="#64748b" fontFamily="Inter,sans-serif">
        {candidate.role}
      </text>
    </g>
  );
}

function SvgCard({
  x,
  y,
  w = 150,
  h = 52,
  label,
  sublabel,
  icon,
  active,
}: {
  x: number;
  y: number;
  w?: number;
  h?: number;
  label: string;
  sublabel: string;
  icon: LEl[];
  active: boolean;
}) {
  const iconColor = active ? "#0f172a" : "#64748b";
  const iconBg = active ? "rgba(15,23,42,0.07)" : "rgba(226,232,240,0.85)";
  return (
    <motion.g
      animate={{ scale: active ? 1.04 : 1 }}
      transition={{ duration: 0.35 }}
      style={{ transformOrigin: `${x + w / 2}px ${y + h / 2}px` }}
    >
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={12}
        ry={12}
        fill="rgba(255,255,255,0.88)"
        stroke="rgba(15,23,42,0.09)"
        strokeWidth={1}
      />
      <rect x={x + 8} y={y + 10} width={32} height={32} rx={8} ry={8} fill={iconBg} />
      <LucideIcon els={icon} cx={x + 24} cy={y + 26} size={16} color={iconColor} />
      <text
        x={x + 48}
        y={y + 22}
        fontSize={12}
        fontWeight={500}
        fill="#0f172a"
        fontFamily="Inter,sans-serif"
      >
        {label}
      </text>
      <text x={x + 48} y={y + 36} fontSize={10} fill="#64748b" fontFamily="Inter,sans-serif">
        {sublabel}
      </text>
      <motion.circle
        cx={x + w - 12}
        cy={y + h / 2}
        r={3}
        fill="#34d399"
        animate={{ opacity: active ? 1 : 0.25, scale: active ? [1, 1.4, 1] : 1 }}
        transition={{ duration: 0.6, repeat: active ? Infinity : 0 }}
      />
    </motion.g>
  );
}

function OtterHub({ phase, topScore }: { phase: Phase; topScore: number }) {
  const processing = phase === "process";
  const active = phase === "process" || phase === "filter";
  const { x, y, r } = AI;
  return (
    <g>
      <motion.circle
        cx={x}
        cy={y}
        animate={{
          r: active ? [68, 76, 68] : [62, 68, 62],
          opacity: active ? [0.55, 0.25, 0.55] : [0.3, 0.18, 0.3],
        }}
        transition={{ duration: active ? 1.8 : 3.2, repeat: Infinity, ease: "easeInOut" }}
        fill="rgba(15,23,42,0.09)"
        filter="url(#hub-glow)"
      />
      <AnimatePresence>
        {active &&
          [0, 0.6, 1.2].map((delay, i) => (
            <motion.circle
              key={`rpl-${i}-${phase}`}
              cx={x}
              cy={y}
              fill="none"
              stroke="rgba(15,23,42,0.3)"
              strokeWidth={1.2}
              initial={{ r: 70, opacity: 0.6 }}
              animate={{ r: 126, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut", delay }}
            />
          ))}
      </AnimatePresence>
      <AnimatePresence>
        {processing &&
          Array.from({ length: 10 }, (_, i) => {
            const angle = (i / 10) * Math.PI * 2;
            return (
              <motion.circle
                key={`p-${i}`}
                cx={x + Math.cos(angle) * 95}
                cy={y + Math.sin(angle) * 95}
                r={2}
                fill="rgba(15,23,42,0.6)"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.12, ease: "easeInOut" }}
              />
            );
          })}
      </AnimatePresence>
      <circle cx={x} cy={y} r={r} fill="white" stroke="rgba(15,23,42,0.08)" strokeWidth={1} />
      <circle cx={x} cy={y} r={r - 2} fill="url(#hub-grad)" />
      <motion.circle
        cx={x}
        cy={y}
        r={r - 8}
        fill="none"
        stroke="rgba(15,23,42,0.18)"
        strokeWidth={1}
        strokeDasharray="4 6"
        animate={{ strokeDashoffset: active ? [0, -200] : 0 }}
        transition={{ duration: 6, repeat: active ? Infinity : 0, ease: "linear" }}
      />
      <motion.g
        animate={{ scale: [1, 1.07, 1] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        style={{ transformOrigin: `${x}px ${y}px` }}
      >
        <image
          href="/brand/hero.png"
          x={x - 65}
          y={y - 68}
          width={130}
          height={94}
          preserveAspectRatio="xMidYMid meet"
        />
      </motion.g>
      <text
        x={x}
        y={y + 30}
        textAnchor="middle"
        fontSize={9}
        letterSpacing={2}
        fill="#94a3b8"
        fontFamily="Inter,sans-serif"
        fontWeight={500}
      >
        {active ? "PROCESSING" : "IDLE"}
      </text>
      <AnimatePresence>
        {active && (
          <motion.g
            key="badge"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
          >
            <rect
              x={x + 8}
              y={y - r - 22}
              width={90}
              height={20}
              rx={10}
              ry={10}
              fill="rgba(236,253,245,0.95)"
              stroke="rgba(167,243,208,0.8)"
              strokeWidth={1}
            />
            <circle cx={x + 20} cy={y - r - 12} r={3} fill="#10b981" />
            <text
              x={x + 26}
              y={y - r - 8}
              fontSize={9}
              fontWeight={600}
              fill="#059669"
              fontFamily="Inter,sans-serif"
            >
              {topScore}% match
            </text>
          </motion.g>
        )}
      </AnimatePresence>
    </g>
  );
}

function PipelineStage({
  index,
  label,
  icon,
  activeIndex,
  celebrate,
}: {
  index: number;
  label: string;
  icon: LEl[];
  activeIndex: number;
  celebrate: boolean;
}) {
  const isActive = activeIndex === index;
  const isPast = activeIndex > index;
  const isHired = index === PIPELINE.length - 1;
  const highlight = isActive || (celebrate && isHired);
  const { x, y } = pipePts[index];
  const w = 150,
    h = 56,
    lx = x - 50,
    ly = y - h / 2;

  const borderColor = highlight
    ? "rgba(15,23,42,0.7)"
    : isPast
      ? "rgba(16,185,129,0.5)"
      : "rgba(15,23,42,0.08)";
  const bgColor = highlight ? "rgba(15,23,42,0.06)" : "rgba(255,255,255,0.82)";
  const iconBg =
    celebrate && isHired
      ? "#10b981"
      : highlight
        ? "#0f172a"
        : isPast
          ? "rgba(16,185,129,0.15)"
          : "rgba(241,245,249,0.9)";
  const iconColor =
    celebrate && isHired ? "#fff" : highlight ? "#fff" : isPast ? "#10b981" : "#64748b";
  const sub = isPast ? "Done" : highlight ? "In progress" : "Waiting";

  return (
    <g>
      <AnimatePresence>
        {celebrate && isHired && (
          <motion.rect
            key="glow"
            x={lx - 4}
            y={ly - 4}
            width={w + 8}
            height={h + 8}
            rx={14}
            ry={14}
            fill="rgba(52,211,153,0.3)"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.6, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1, repeat: Infinity }}
          />
        )}
      </AnimatePresence>
      <motion.rect
        x={lx}
        y={ly}
        width={w}
        height={h}
        rx={12}
        ry={12}
        animate={{ fill: bgColor }}
        transition={{ duration: 0.35 }}
      />
      <motion.rect
        x={lx}
        y={ly}
        width={w}
        height={h}
        rx={12}
        ry={12}
        fill="none"
        animate={{ stroke: borderColor }}
        strokeWidth={1}
        transition={{ duration: 0.35 }}
      />
      <motion.rect
        x={lx + 10}
        y={ly + 12}
        width={32}
        height={32}
        rx={8}
        ry={8}
        animate={{ fill: iconBg }}
        transition={{ duration: 0.3 }}
      />
      <LucideIcon els={icon} cx={lx + 26} cy={ly + 28} size={16} color={iconColor} />
      <text
        x={lx + 50}
        y={ly + 24}
        fontSize={11}
        fontWeight={500}
        fill="#0f172a"
        fontFamily="Inter,sans-serif"
      >
        {label}
      </text>
      <text x={lx + 50} y={ly + 38} fontSize={9} fill="#64748b" fontFamily="Inter,sans-serif">
        {sub}
      </text>
    </g>
  );
}

function FlowArrow({ d, active, delay = 0 }: { d: string; active: boolean; delay?: number }) {
  return (
    <g>
      <path
        d={d}
        fill="none"
        stroke="rgba(148,163,184,0.28)"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <motion.path
        d={d}
        fill="none"
        stroke="rgba(15,23,42,0.8)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray="6 10"
        initial={{ strokeDashoffset: 0, opacity: 0 }}
        animate={{ strokeDashoffset: active ? -320 : 0, opacity: active ? 1 : 0 }}
        transition={{
          strokeDashoffset: { duration: 2.4, repeat: active ? Infinity : 0, ease: "linear", delay },
          opacity: { duration: 0.4, delay },
        }}
      />
    </g>
  );
}

export default function OtterFlowHero() {
  const { phase, cycle } = usePhase();
  const [topScore, setTopScore] = useState(0);
  const [stageIndex, setStageIndex] = useState(-1);

  useEffect(() => {
    if (phase === "ingest") {
      setTopScore(0);
      return;
    }
    if (phase === "process") {
      let raf = 0;
      const start = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - start) / PHASE_MS.process);
        setTopScore(Math.round(p * 92));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }
    if (phase === "filter" || phase === "pipeline" || phase === "celebrate") setTopScore(92);
  }, [phase, cycle]);

  useEffect(() => {
    if (phase !== "pipeline") {
      if (phase === "ingest") setStageIndex(-1);
      if (phase === "celebrate") setStageIndex(PIPELINE.length); // keep all as Done; celebrate styling uses the prop
      return;
    }
    // stageIndex=0 immediately so Applied shows "In progress" while card travels
    setStageIndex(0);
    // Card arrives at Applied after 2.2s; split remaining time across
    // 3 stage activations + 1 final "all done" tick (stageIndex = PIPELINE.length)
    const cardArrivalMs = 2200;
    const totalEvents = PIPELINE.length; // 4 events: Screening, Interview, Hired, AllDone
    const step = (PHASE_MS.pipeline - cardArrivalMs) / totalEvents;
    const timers = [
      ...Array.from({ length: PIPELINE.length - 1 }, (_, i) =>
        setTimeout(() => setStageIndex(i + 1), cardArrivalMs + i * step),
      ),
      // Push stageIndex past last stage so Hired shows "Done"
      setTimeout(
        () => setStageIndex(PIPELINE.length),
        cardArrivalMs + (PIPELINE.length - 1) * step,
      ),
    ];
    return () => timers.forEach(clearTimeout);
  }, [phase, cycle]);

  const ingestActive = phase === "ingest";
  const pipeFlowActive = phase === "filter" || phase === "pipeline";
  const aiPath = aiToPipePath();
  const winner = CANDIDATES.find((c) => c.pass) ?? CANDIDATES[0];

  return (
    <div className="relative mx-auto w-full max-w-[1280px]">
      <div className="rounded-[34px] border border-black/8 bg-white/48 p-3 shadow-[0_28px_80px_rgba(15,23,42,0.08)] sm:p-5">
        <svg
          viewBox={`0 0 ${VB.w} ${VB.h}`}
          className="block h-auto w-full"
          role="img"
          aria-label="Otter ATS workflow animation"
          xmlns="http://www.w3.org/2000/svg"
          xmlnsXlink="http://www.w3.org/1999/xlink"
        >
          <defs>
            <filter id="hub-glow" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="18" />
            </filter>
            <radialGradient id="hub-grad" cx="50%" cy="30%" r="70%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.98)" />
              <stop offset="60%" stopColor="rgba(248,250,252,0.96)" />
              <stop offset="100%" stopColor="rgba(241,245,249,0.94)" />
            </radialGradient>
          </defs>

          {/* flow arrows source → hub */}
          {SOURCES.map((_, i) => (
            <FlowArrow key={`fa-${i}`} d={srcPath(i)} active={ingestActive} delay={i * 0.25} />
          ))}

          {/* flow arrow hub → pipeline */}
          <FlowArrow d={aiPath} active={pipeFlowActive || phase === "celebrate"} />

          {/* source node cards */}
          {SOURCES.map((src, i) => (
            <SvgCard
              key={src.id}
              x={srcPts[i].x - 90}
              y={srcPts[i].y - 26}
              label={src.label}
              sublabel="Live"
              icon={src.icon}
              active={ingestActive}
            />
          ))}

          {/* 4 candidate cards traveling from each source → hub */}
          {CANDIDATES.map((c, i) => (
            <PathCard
              key={`tc-${c.id}-${cycle}`}
              candidate={c}
              pathD={srcPath(i)}
              active={ingestActive}
              delay={0.15 + i * 0.35}
              duration={2.2}
              lingerMs={600}
            />
          ))}

          {/* winner card traveling hub → pipeline (behind hub) */}
          <PathCard
            key={`winner-${cycle}`}
            candidate={winner}
            pathD={aiPath}
            active={phase === "pipeline"}
            delay={0}
            duration={2.2}
          />

          {/* hub renders above traveling cards */}
          <OtterHub phase={phase} topScore={topScore} />

          {/* pipeline stages */}
          {PIPELINE.map((item, i) => (
            <PipelineStage
              key={item.id}
              index={i}
              label={item.label}
              icon={item.icon}
              activeIndex={stageIndex}
              celebrate={phase === "celebrate"}
            />
          ))}
        </svg>
      </div>
    </div>
  );
}
