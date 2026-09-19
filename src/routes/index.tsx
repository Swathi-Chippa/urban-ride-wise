import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { OperatorView } from "@/components/OperatorView";
import { PassengerView } from "@/components/PassengerView";
import {
  BASE_LOG,
  SIGNAL_LOG,
  type LogEntry,
  type SignalId,
} from "@/lib/transit";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TransitBrain AI — City Transit Optimization" },
      {
        name: "description",
        content:
          "Operator dashboard and passenger app for AI-optimized city bus routing: live demand heatmaps, signal simulation, and least-crowded bus recommendations.",
      },
      { property: "og:title", content: "TransitBrain AI — City Transit Optimization" },
      {
        property: "og:description",
        content:
          "Simulate city signals, watch AI agents re-route buses, and get the least-crowded ride recommendation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function timeNow() {
  return new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function Index() {
  const [view, setView] = useState<"operator" | "passenger">("operator");
  const [active, setActive] = useState<SignalId[]>([]);
  const [log, setLog] = useState<LogEntry[]>(BASE_LOG);

  const toggle = (id: SignalId) => {
    const on = active.includes(id);
    setActive(on ? active.filter((s) => s !== id) : [...active, id]);

    const time = timeNow();
    const entries: LogEntry[] = on
      ? [
          {
            id: `${id}-off-${Date.now()}`,
            agent: "Routing agent",
            message: "Signal cleared — corridor returning to baseline plan",
            dot: "violet",
            time,
          },
        ]
      : SIGNAL_LOG[id].map((e, i) => ({
          ...e,
          id: `${id}-${Date.now()}-${i}`,
          time,
        }));

    setLog((prev) => [...entries, ...prev].slice(0, 14));
  };

  return (
    <div className="min-h-screen bg-ink text-white font-body">
      <header className="sticky top-0 z-30 bg-ink/95 border-b border-white/10 backdrop-blur">
        <div className="max-w-[1440px] mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-lime grid place-items-center">
              <span className="font-display font-bold text-ink text-lg">T</span>
            </div>
            <div>
              <p className="font-display font-bold text-lg leading-none tracking-tight">
                TransitBrain <span className="text-lime">AI</span>
              </p>
              <p className="text-[11px] text-white/40 -mt-0.5">
                City Transit Optimization
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-panel rounded-full p-1 border border-white/10">
            <button
              onClick={() => setView("operator")}
              className={
                view === "operator"
                  ? "px-5 py-2 rounded-full bg-lime text-ink font-display font-semibold text-sm"
                  : "px-5 py-2 rounded-full text-white/60 font-display font-semibold text-sm hover:text-white"
              }
            >
              Operator View
            </button>
            <button
              onClick={() => setView("passenger")}
              className={
                view === "passenger"
                  ? "px-5 py-2 rounded-full bg-lime text-ink font-display font-semibold text-sm"
                  : "px-5 py-2 rounded-full text-white/60 font-display font-semibold text-sm hover:text-white"
              }
            >
              Passenger View
            </button>
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs text-white/50">
            <span className="size-2 rounded-full bg-lime animate-pulse" /> Live ·{" "}
            {timeNow()}
          </div>
        </div>
      </header>

      <main className="max-w-[1440px] mx-auto px-6 py-6">
        {view === "operator" ? (
          <OperatorView active={active} toggle={toggle} log={log} />
        ) : (
          <PassengerView active={active} />
        )}
      </main>
    </div>
  );
}
