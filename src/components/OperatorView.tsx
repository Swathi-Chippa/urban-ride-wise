import { useState, type FormEvent } from "react";
import {
  manuallyAllocateBus,
  processCitySignal,
  type CityDisruptionType,
} from "@/lib/transitBrain";
import type { LogEntry, SignalId } from "@/lib/transit";

export interface OperatorViewProps {
  active: SignalId[];
  toggle: (id: SignalId) => void;
  log: LogEntry[];
}

interface StandbyBus {
  busNumber: string;
  currentRoute: string;
  status: "Standby" | "Repositioning";
}
interface DisruptionEvent {
  id: CityDisruptionType;
  label: string;
  icon: string;
}

const events: DisruptionEvent[] = [
  { id: "bandh", label: "Bandh / Strike", icon: "🛑" },
  { id: "waterlogging", label: "Heavy Rain / Waterlogging", icon: "🌊" },
  { id: "roadwork", label: "Road Work / Construction Detour", icon: "🚧" },
  { id: "vip_movement", label: "VIP Movement Freeze", icon: "🏛" },
  { id: "exam_surge", label: "College Exam / Event Demand Surge", icon: "🎓" },
];

const routes = ["Route 218", "Route 113", "Route 7"];
const inputClassName =
  "mt-1.5 w-full rounded-xl border border-white/10 bg-panel2 px-3.5 py-3 text-sm text-white outline-none transition focus:border-lime/50";

export function OperatorView({ active, toggle, log }: OperatorViewProps) {
  const [officerCode, setOfficerCode] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [standbyBuses, setStandbyBuses] = useState<StandbyBus[]>([
    { busNumber: "TS09Z7001", currentRoute: "Depot South", status: "Standby" },
    { busNumber: "TS09Z7002", currentRoute: "Depot South", status: "Standby" },
    { busNumber: "TS09Z7003", currentRoute: "Depot South", status: "Standby" },
  ]);
  const [allocationRoute, setAllocationRoute] = useState(routes[0]!);
  const [selectedBus, setSelectedBus] = useState(standbyBuses[0]!.busNumber);
  const [eventState, setEventState] = useState<Record<CityDisruptionType, boolean>>({
    bandh: false,
    waterlogging: false,
    roadwork: false,
    vip_movement: false,
    exam_surge: false,
  });
  const [notice, setNotice] = useState("");

  function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (officerCode.trim().length < 4) {
      setNotice("Enter a valid RTC officer badge ID or officer code.");
      return;
    }
    setIsAuthenticated(true);
    setNotice(`Officer #${officerCode.trim()} authenticated for Depot South.`);
  }

  async function toggleDisruption(event: DisruptionEvent) {
    const nextActive = !eventState[event.id];
    setEventState((current) => ({ ...current, [event.id]: nextActive }));
    const result = await processCitySignal(event.id, nextActive);
    if (result)
      setNotice(
        `${event.label}: predicted demand ${result.predictedDemand}. ${result.standbyUnitsDispatched ? "Standby units dispatched." : "No standby dispatch required."}`,
      );
    else setNotice(`${event.label} updated locally; awaiting route signal data.`);
    if (event.id === "exam_surge" && !active.includes("exam")) toggle("exam");
    if (event.id === "waterlogging" && !active.includes("rain")) toggle("rain");
  }

  async function allocateBus() {
    const result = await manuallyAllocateBus(selectedBus, allocationRoute);
    setNotice(result.message);
    setStandbyBuses((current) =>
      current.map((bus) =>
        bus.busNumber === selectedBus
          ? { ...bus, currentRoute: allocationRoute, status: "Repositioning" }
          : bus,
      ),
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-xl mx-auto">
        <section className="bg-panel rounded-3xl p-6 border border-white/10 space-y-5">
          <div>
            <span className="text-xs font-bold tracking-widest uppercase text-lime bg-lime/10 px-3 py-1 rounded-full border border-lime/20">
              RTC Depot Control
            </span>
            <h2 className="font-display font-bold text-2xl tracking-tight mt-3">
              Officer Verification Gate
            </h2>
            <p className="text-xs text-white/50 mt-1">
              Authenticate with your Badge ID / Officer Code to unlock fleet controls.
            </p>
          </div>
          <form onSubmit={authenticate} className="space-y-4">
            <label className="block text-xs font-semibold text-white/70">
              Badge ID / Officer Code
              <input
                required
                className={inputClassName}
                value={officerCode}
                onChange={(event) => setOfficerCode(event.target.value)}
                placeholder="RTC-4092"
              />
            </label>
            <button
              type="submit"
              className="w-full rounded-xl bg-lime py-3 text-sm font-display font-bold text-ink hover:bg-lime/90 transition-all"
            >
              Unlock Depot Controls
            </button>
          </form>
          {notice && (
            <p
              role="status"
              className="rounded-xl border border-amber/30 bg-amber/10 p-3 text-xs text-amber"
            >
              {notice}
            </p>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="bg-panel rounded-3xl p-5 border border-white/10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold tracking-widest uppercase text-lime bg-lime/10 px-3 py-1 rounded-full border border-lime/20">
              RTC Depot Administrative Controls
            </span>
            <h2 className="font-display font-bold text-xl tracking-tight mt-3">
              Officer #{officerCode} · Zone Depot South
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setIsAuthenticated(false)}
            className="text-xs font-bold text-white/55 hover:text-white"
          >
            Lock Controls
          </button>
        </div>
      </section>
      {notice && (
        <div
          role="status"
          className="rounded-2xl border border-lime/30 bg-lime/10 px-4 py-3 text-xs font-semibold text-lime"
        >
          {notice}
        </div>
      )}
      <section className="bg-panel rounded-3xl p-5 border border-white/10 space-y-4">
        <div>
          <h2 className="font-display font-bold text-lg">
            Fleet Allocation &amp; Diagnostic Control
          </h2>
          <p className="text-xs text-white/45 mt-1">
            Allocate standby units and inspect active operational incidents.
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-panel2 rounded-2xl border border-white/10 p-4 space-y-3">
            <p className="text-xs font-bold text-lime uppercase tracking-wider">Standby Fleet</p>
            {standbyBuses.map((bus) => (
              <div
                key={bus.busNumber}
                className="flex items-center justify-between gap-3 border-b border-white/10 pb-2 last:border-0 last:pb-0"
              >
                <div>
                  <p className="text-sm font-bold text-white">{bus.busNumber}</p>
                  <p className="text-[11px] text-white/50">{bus.currentRoute}</p>
                </div>
                <span
                  className={`text-[10px] font-bold ${bus.status === "Standby" ? "text-lime" : "text-amber"}`}
                >
                  {bus.status}
                </span>
              </div>
            ))}
          </div>
          <div className="bg-panel2 rounded-2xl border border-white/10 p-4 space-y-3">
            <p className="text-xs font-bold text-lime uppercase tracking-wider">
              Manual Allocation Override
            </p>
            <label className="block text-xs font-semibold text-white/70">
              Standby Bus
              <select
                className={inputClassName}
                value={selectedBus}
                onChange={(event) => setSelectedBus(event.target.value)}
              >
                {standbyBuses
                  .filter((bus) => bus.status === "Standby" || bus.busNumber === selectedBus)
                  .map((bus) => (
                    <option key={bus.busNumber}>{bus.busNumber}</option>
                  ))}
              </select>
            </label>
            <label className="block text-xs font-semibold text-white/70">
              Allocate Bus to Route
              <select
                className={inputClassName}
                value={allocationRoute}
                onChange={(event) => setAllocationRoute(event.target.value)}
              >
                {routes.map((route) => (
                  <option key={route}>{route}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={allocateBus}
              className="w-full rounded-xl bg-lime py-2.5 text-xs font-display font-bold text-ink hover:bg-lime/90"
            >
              Allocate Bus to Route
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3">
            <p className="text-[10px] uppercase tracking-wider text-red-300 font-bold">
              Active Breakdowns
            </p>
            <p className="text-sm text-white mt-1">1 incident · TS09Z1234</p>
            <p className="text-[11px] text-white/50 mt-1">Backup dispatch monitoring active</p>
          </div>
          <div className="rounded-2xl border border-amber/20 bg-amber/10 p-3">
            <p className="text-[10px] uppercase tracking-wider text-amber font-bold">
              Driver / Conductor Feedback
            </p>
            <p className="text-sm text-white mt-1">3 reports awaiting audit</p>
            <p className="text-[11px] text-white/50 mt-1">Conduct and delay reports queued</p>
          </div>
        </div>
      </section>
      <section className="bg-panel rounded-3xl p-5 border border-white/10 space-y-4">
        <div>
          <h2 className="font-display font-bold text-lg">City Disruption Management</h2>
          <p className="text-xs text-white/45 mt-1">
            Toggle conditions to recalculate route demand and dispatch standby units.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {events.map((event) => (
            <button
              key={event.id}
              type="button"
              aria-pressed={eventState[event.id]}
              onClick={() => toggleDisruption(event)}
              className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left text-xs font-bold transition ${eventState[event.id] ? "border-lime/40 bg-lime text-ink" : "border-white/10 bg-panel2 text-white/70 hover:border-lime/40"}`}
            >
              <span className="text-lg">{event.icon}</span>
              <span>{event.label}</span>
              <span
                className={`ml-auto size-2 rounded-full ${eventState[event.id] ? "bg-ink" : "bg-white/30"}`}
              />
            </button>
          ))}
        </div>
      </section>
      <section className="bg-panel rounded-3xl border border-white/10 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-lg">AI Agent Activity</h2>
          <span className="text-[10px] uppercase tracking-widest text-lime bg-lime/10 border border-lime/20 rounded-full px-2.5 py-1">
            {active.length + 3} agents
          </span>
        </div>
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {log.map((entry) => (
            <div key={entry.id} className="bg-panel2/60 rounded-2xl p-3 border border-white/10">
              <p className="text-sm font-semibold">{entry.agent}</p>
              <p className="text-xs text-white/50">
                {entry.message} · {entry.time}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
