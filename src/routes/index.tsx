import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { OperatorView } from "@/components/OperatorView";
import { PassengerView } from "@/components/PassengerView";
import { ConductorView } from "@/components/ConductorView";
import type { SignalId } from "@/lib/transit";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BusMitra AI — Conductor-Verified Transit Intelligence" },
      {
        name: "description",
        content:
          "Conductor-verified bus tracking, automated RTC depot fleet optimization, and proactive student transit demand management.",
      },
      { property: "og:title", content: "BusMitra AI — Transit Intelligence" },
      {
        property: "og:description",
        content:
          "Verify trip status with conductors, dispatch backup fleets automatically from the depot, and eliminate student transit delays.",
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
  const [view, setView] = useState<"student" | "conductor" | "depot">("student");
  const [active, setActive] = useState<SignalId[]>([]);

  const toggle = (id: SignalId) => {
    const on = active.includes(id);
    setActive(on ? active.filter((s) => s !== id) : [...active, id]);
  };

  return (
    <div className="min-h-screen bg-ink text-white font-body">
      <header className="sticky top-0 z-30 bg-ink/95 border-b border-white/10 backdrop-blur">
        <div className="max-w-[1440px] mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-lime grid place-items-center">
              <span className="font-display font-bold text-ink text-lg">🚌</span>
            </div>
            <div>
              <p className="font-display font-bold text-lg leading-none tracking-tight">
                BusMitra <span className="text-lime">AI</span>
              </p>
              <p className="text-[11px] text-white/40 -mt-0.5">
                Verified Transit Optimization
              </p>
            </div>
          </div>

          {/* 3-Role View Navigation */}
          <div className="flex items-center gap-1 bg-panel rounded-full p-1 border border-white/10">
            <button
              onClick={() => setView("student")}
              className={
                view === "student"
                  ? "px-4 py-1.5 rounded-full bg-lime text-ink font-display font-semibold text-xs transition-all"
                  : "px-4 py-1.5 rounded-full text-white/60 font-display font-semibold text-xs hover:text-white transition-all"
              }
            >
              🎓 Student App
            </button>
            <button
              onClick={() => setView("conductor")}
              className={
                view === "conductor"
                  ? "px-4 py-1.5 rounded-full bg-lime text-ink font-display font-semibold text-xs transition-all"
                  : "px-4 py-1.5 rounded-full text-white/60 font-display font-semibold text-xs hover:text-white transition-all"
              }
            >
              🎫 Conductor Portal
            </button>
            <button
              onClick={() => setView("depot")}
              className={
                view === "depot"
                  ? "px-4 py-1.5 rounded-full bg-lime text-ink font-display font-semibold text-xs transition-all"
                  : "px-4 py-1.5 rounded-full text-white/60 font-display font-semibold text-xs hover:text-white transition-all"
              }
            >
              🏢 RTC Depot
            </button>
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs text-white/50">
            <span className="size-2 rounded-full bg-lime animate-pulse" /> Live ·{" "}
            {timeNow()}
          </div>
        </div>
      </header>

      <main className="max-w-[1440px] mx-auto px-6 py-6">
        {view === "student" && <PassengerView active={active} />}
        {view === "conductor" && <ConductorView />}
        {view === "depot" && (
          <OperatorView active={active} toggle={toggle} />
        )}
      </main>
    </div>
  );
}
