export type SignalId = "exam" | "rain" | "concert";

export type Signal = {
  id: SignalId;
  label: string;
  accent: "sky" | "coral" | "amber";
  hotspot: { left: string; top: string; size: string; tint: string; label: string };
};

export const SIGNALS: Signal[] = [
  {
    id: "exam",
    label: "College Exam Ends",
    accent: "sky",
    hotspot: {
      left: "15%",
      top: "20%",
      size: "10rem",
      tint: "rgba(77,214,255,0.28)",
      label: "Exam District",
    },
  },
  {
    id: "rain",
    label: "Heavy Rain",
    accent: "coral",
    hotspot: {
      left: "42%",
      top: "52%",
      size: "13rem",
      tint: "rgba(167,139,250,0.28)",
      label: "Downtown Core",
    },
  },
  {
    id: "concert",
    label: "Concert Surge",
    accent: "amber",
    hotspot: {
      left: "70%",
      top: "58%",
      size: "12rem",
      tint: "rgba(255,207,63,0.28)",
      label: "Riverside Arena",
    },
  },
];

export type LogEntry = {
  id: string;
  agent: string;
  message: string;
  dot: "lime" | "sky" | "coral" | "amber" | "violet";
  time: string;
};

export const BASE_LOG: LogEntry[] = [
  {
    id: "base-1",
    agent: "Demand forecaster",
    message: "Baseline load steady across 12 corridors",
    dot: "sky",
    time: "3:38 PM",
  },
  {
    id: "base-2",
    agent: "Access planner",
    message: "All low-floor vehicles reporting nominal",
    dot: "violet",
    time: "3:35 PM",
  },
];

export const SIGNAL_LOG: Record<SignalId, Omit<LogEntry, "id" | "time">[]> = {
  exam: [
    {
      agent: "Routing agent",
      message: "Re-routed 6 buses toward Exam District gates",
      dot: "lime",
    },
    {
      agent: "Demand forecaster",
      message: "Predicted +40% load on Route 4 within 15 min",
      dot: "sky",
    },
  ],
  rain: [
    {
      agent: "Relief dispatcher",
      message: "Rain detected — headway tightened to 5 min downtown",
      dot: "coral",
    },
    {
      agent: "Access planner",
      message: "Prioritised sheltered stops for wheelchair boardings",
      dot: "violet",
    },
  ],
  concert: [
    {
      agent: "Relief dispatcher",
      message: "Staged 4 spare buses at Riverside Arena",
      dot: "amber",
    },
    {
      agent: "Routing agent",
      message: "Route 7 extended to arena loop until 11:30 PM",
      dot: "lime",
    },
  ],
};

export type Bus = {
  id: string;
  left: string;
  top: string;
  delay: string;
};

export const BUSES: Bus[] = [
  { id: "b1", left: "30%", top: "60%", delay: "0s" },
  { id: "b2", left: "62%", top: "30%", delay: "0.4s" },
  { id: "b3", left: "78%", top: "62%", delay: "0.8s" },
  { id: "b4", left: "20%", top: "38%", delay: "1.2s" },
];

export type Destination = {
  id: string;
  name: string;
  detail: string;
};

export const DESTINATIONS: Destination[] = [
  { id: "arena", name: "Riverside Arena", detail: "Concert · 9:00 PM" },
  { id: "campus", name: "Northgate Campus", detail: "Exam block · Gate 3" },
  { id: "market", name: "Old Market Square", detail: "Shops open till 10 PM" },
  { id: "airport", name: "City Airport T2", detail: "Express corridor" },
];

export type BusOption = {
  route: string;
  kind: string;
  etaMin: number;
  crowd: number;
  accessible: boolean;
};

const BASE_OPTIONS: Record<string, BusOption[]> = {
  arena: [
    { route: "Route 4", kind: "Express", etaMin: 6, crowd: 32, accessible: true },
    { route: "Route 12", kind: "Local", etaMin: 11, crowd: 58, accessible: true },
    { route: "Route 7", kind: "Crosstown", etaMin: 14, crowd: 74, accessible: false },
  ],
  campus: [
    { route: "Route 21", kind: "Campus line", etaMin: 4, crowd: 28, accessible: true },
    { route: "Route 4", kind: "Express", etaMin: 9, crowd: 47, accessible: true },
    { route: "Route 9", kind: "Local", etaMin: 13, crowd: 66, accessible: false },
  ],
  market: [
    { route: "Route 2", kind: "Loop", etaMin: 5, crowd: 35, accessible: true },
    { route: "Route 12", kind: "Local", etaMin: 8, crowd: 52, accessible: false },
    { route: "Route 18", kind: "Night line", etaMin: 16, crowd: 41, accessible: true },
  ],
  airport: [
    { route: "Route 90", kind: "Airport express", etaMin: 7, crowd: 24, accessible: true },
    { route: "Route 33", kind: "Crosstown", etaMin: 12, crowd: 49, accessible: true },
    { route: "Route 5", kind: "Local", etaMin: 19, crowd: 63, accessible: false },
  ],
};

export function crowdLabel(crowd: number): string {
  if (crowd < 40) return "Low";
  if (crowd < 65) return "Med";
  return "High";
}

export function optionsFor(destinationId: string, active: SignalId[]): BusOption[] {
  const base = BASE_OPTIONS[destinationId] ?? BASE_OPTIONS["arena"]!;
  const bump =
    (active.includes("exam") ? 12 : 0) +
    (active.includes("rain") ? 9 : 0) +
    (active.includes("concert") ? 15 : 0);
  const delay = active.length * 2;

  return base
    .map((o, i) => ({
      ...o,
      crowd: Math.min(97, o.crowd + (i === 0 ? Math.round(bump * 0.4) : bump)),
      etaMin: o.etaMin + (i === 0 ? Math.round(delay / 2) : delay),
    }))
    .sort((a, b) => a.crowd - b.crowd || a.etaMin - b.etaMin);
}
