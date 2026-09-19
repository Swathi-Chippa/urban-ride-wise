import { useState } from "react";
import {
  DESTINATIONS,
  crowdLabel,
  optionsFor,
  type SignalId,
} from "@/lib/transit";

export function PassengerView({ active }: { active: SignalId[] }) {
  const [destId, setDestId] = useState(DESTINATIONS[0]!.id);
  const dest = DESTINATIONS.find((d) => d.id === destId)!;
  const options = optionsFor(destId, active);
  const best = options[0]!;
  const alts = options.slice(1);

  return (
    <div className="flex justify-center py-4">
      {/* mobile frame */}
      <div className="w-[390px] rounded-[42px] border border-white/15 bg-panel p-3 shadow-2xl shadow-lime/10">
        <div className="rounded-[32px] bg-ink overflow-hidden">
          <div className="flex items-center justify-between px-6 pt-4 text-[11px] text-white/50">
            <span>9:41</span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-lime animate-pulse" /> Live
            </span>
          </div>

          <div className="px-5 pt-4 pb-6 space-y-4">
            <div>
              <p className="font-display font-bold text-xl tracking-tight">
                Where to?
              </p>
              <p className="text-xs text-white/40">From Maple &amp; 5th</p>
            </div>

            {/* destination selector */}
            <div>
              <label
                htmlFor="dest"
                className="text-[11px] uppercase tracking-widest text-white/40"
              >
                Destination
              </label>
              <div className="mt-2 flex items-center gap-3 bg-panel2 rounded-2xl px-4 py-3 border border-sky/30">
                <span className="size-8 rounded-xl bg-sky/15 grid place-items-center text-sky shrink-0">
                  ◈
                </span>
                <div className="min-w-0 flex-1">
                  <select
                    id="dest"
                    value={destId}
                    onChange={(e) => setDestId(e.target.value)}
                    className="w-full bg-transparent font-display font-semibold text-white outline-none"
                  >
                    {DESTINATIONS.map((d) => (
                      <option key={d.id} value={d.id} className="bg-panel2 text-white">
                        {d.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-white/40">{dest.detail}</p>
                </div>
              </div>
            </div>

            {/* best bus */}
            <div>
              <p className="text-[11px] uppercase tracking-widest text-white/40 mb-2">
                Recommended best bus for you
              </p>
              <div className="bg-lime text-ink rounded-3xl p-5 shadow-xl shadow-lime/20">
                <span className="inline-block text-[10px] font-bold uppercase tracking-widest bg-ink text-lime rounded-full px-2.5 py-1">
                  Best for you
                </span>
                <p className="font-display font-bold text-2xl mt-3 leading-none">
                  {best.route}
                </p>
                <p className="text-sm font-medium mt-1">
                  {best.kind} · Lowest predicted crowding
                </p>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-sm font-semibold">
                    <span>ETA</span>
                    <span>{best.etaMin} min</span>
                  </div>
                  <div className="flex items-center justify-between text-sm font-semibold">
                    <span>Crowd</span>
                    <span>
                      {crowdLabel(best.crowd)} · {best.crowd}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm font-semibold">
                    <span>Wheelchair</span>
                    <span>{best.accessible ? "✓ Accessible" : "— Standard"}</span>
                  </div>
                </div>
                <button className="mt-5 w-full bg-ink text-lime font-display font-bold rounded-2xl py-3">
                  Board this bus
                </button>
              </div>
            </div>

            {/* alternatives */}
            <div className="space-y-3">
              {alts.map((o) => (
                <div
                  key={o.route}
                  className="bg-panel2 rounded-3xl p-4 border border-white/10"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-display font-bold text-lg leading-none">
                        {o.route}
                      </p>
                      <p className="text-xs text-white/50 mt-1">
                        {o.kind} · {crowdLabel(o.crowd)} crowd {o.crowd}%
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-display font-bold text-lg leading-none">
                        {o.etaMin} min
                      </p>
                      <p className="text-xs text-white/40 mt-1">
                        {o.accessible ? "♿ Accessible" : "Standard"}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
