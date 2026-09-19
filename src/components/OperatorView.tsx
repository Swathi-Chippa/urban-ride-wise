import {
  BUSES,
  SIGNALS,
  type LogEntry,
  type SignalId,
} from "@/lib/transit";

const dotClass: Record<LogEntry["dot"], string> = {
  lime: "bg-lime",
  sky: "bg-sky",
  coral: "bg-coral",
  amber: "bg-amber",
  violet: "bg-violet",
};

const idleDot: Record<string, string> = {
  sky: "bg-sky/40",
  coral: "bg-coral/40",
  amber: "bg-amber/40",
};

const hoverBorder: Record<string, string> = {
  sky: "hover:border-sky/50",
  coral: "hover:border-coral/50",
  amber: "hover:border-amber/50",
};

type Props = {
  active: SignalId[];
  toggle: (id: SignalId) => void;
  log: LogEntry[];
};

export function OperatorView({ active, toggle, log }: Props) {
  const hotspots = SIGNALS.filter((s) => active.includes(s.id));

  return (
    <div className="space-y-6">
      {/* SIGNALS BAR */}
      <section className="bg-panel rounded-3xl p-5 border border-white/10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-lime text-lg">◉</span>
            <div>
              <h2 className="font-display font-bold text-xl tracking-tight">
                City Signals Simulation
              </h2>
              <p className="text-xs text-white/40">
                Toggle demand events to watch AI agents re-route in real time
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {SIGNALS.map((s) => {
              const on = active.includes(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => toggle(s.id)}
                  aria-pressed={on}
                  className={
                    on
                      ? "flex items-center gap-2 px-5 py-3 rounded-2xl bg-lime text-ink font-display font-semibold text-sm shadow-lg shadow-lime/20"
                      : `flex items-center gap-2 px-5 py-3 rounded-2xl bg-panel2 text-white/70 border border-white/10 font-display font-semibold text-sm transition-colors ${hoverBorder[s.accent]}`
                  }
                >
                  <span
                    className={`size-2.5 rounded-full ${on ? "bg-ink" : idleDot[s.accent]}`}
                  />
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* MAP + LOG */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 bg-panel rounded-3xl border border-white/10 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <h2 className="font-display font-bold text-lg tracking-tight">Live City Map</h2>
            <div className="flex items-center gap-4 text-[11px] text-white/50">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-sky" /> Route 4
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-coral" /> Route 12
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-amber" /> Route 7
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-lime" /> Bus
              </span>
            </div>
          </div>

          <div className="relative h-[440px] bg-panel2/40">
            <div
              className="absolute inset-0 opacity-[0.15]"
              style={{
                backgroundImage:
                  "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)",
                backgroundSize: "44px 44px",
              }}
            />

            {/* demand heatmap */}
            {hotspots.map((s) => (
              <div
                key={s.id}
                className="absolute rounded-full blur-2xl transition-opacity duration-500"
                style={{
                  left: s.hotspot.left,
                  top: s.hotspot.top,
                  width: s.hotspot.size,
                  height: s.hotspot.size,
                  background: s.hotspot.tint,
                }}
              />
            ))}

            {/* routes */}
            <div className="absolute left-[8%] top-[70%] h-1.5 w-[60%] rounded-full bg-sky/70 -rotate-12" />
            <div className="absolute left-[30%] top-[10%] h-1.5 w-[55%] rounded-full bg-coral/70 rotate-[20deg]" />
            <div className="absolute left-[55%] top-[40%] h-1.5 w-[40%] rounded-full bg-amber/70 -rotate-6" />

            {/* bus markers */}
            {BUSES.map((b) => (
              <div
                key={b.id}
                className="absolute size-7 rounded-full bg-lime grid place-items-center shadow-lg shadow-lime/40 bus-bob"
                style={{ left: b.left, top: b.top, animationDelay: b.delay }}
              >
                <span className="size-2.5 rounded-full bg-ink" />
              </div>
            ))}

            {/* hotspot labels */}
            {hotspots.map((s) => (
              <span
                key={`l-${s.id}`}
                className="absolute text-[10px] uppercase tracking-widest text-white/70"
                style={{ left: s.hotspot.left, top: `calc(${s.hotspot.top} - 18px)` }}
              >
                {s.hotspot.label}
              </span>
            ))}

            <div className="absolute bottom-4 left-4 bg-ink/70 rounded-full px-3 py-1.5 text-[11px] text-white/60 border border-white/10">
              {128 + active.length * 9} vehicles · {hotspots.length} demand hotspots active
            </div>
          </div>
        </section>

        {/* AI LOG */}
        <section className="bg-panel rounded-3xl border border-white/10 p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-lg tracking-tight">
              AI Agent Activity
            </h2>
            <span className="text-[10px] uppercase tracking-widest text-lime bg-lime/10 border border-lime/20 rounded-full px-2.5 py-1">
              {active.length > 0 ? "5 agents" : "3 agents"}
            </span>
          </div>
          <div className="space-y-3 max-h-[440px] overflow-y-auto pr-1">
            {log.map((e, i) => (
              <div
                key={e.id}
                className={`log-in flex gap-3 bg-panel2/60 rounded-2xl p-3 border ${i === 0 ? "border-lime/20" : "border-white/10"}`}
              >
                <span
                  className={`mt-0.5 size-2.5 rounded-full shrink-0 ${dotClass[e.dot]}`}
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{e.agent}</p>
                  <p className="text-xs text-white/50">
                    {e.message} · {e.time}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
