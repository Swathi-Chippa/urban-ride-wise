import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  manuallyAllocateBus,
  processCitySignal,
  type CityDisruptionType,
} from "@/lib/transitBrain";
import type { SignalId } from "@/lib/transit";
import { supabase } from "@/lib/supabase";

export interface OperatorViewProps {
  active: SignalId[];
  toggle: (id: SignalId) => void;
}
interface FleetBus {
  id: string;
  busNumber: string;
  routeId: string | null;
  status: string;
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

function displayStatus(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function OperatorView({ active, toggle }: OperatorViewProps) {
  const [officerCode, setOfficerCode] = useState("");
  const [officerName, setOfficerName] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [fleetBuses, setFleetBuses] = useState<FleetBus[]>([]);
  const [feedbackCount, setFeedbackCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [allocationRoute, setAllocationRoute] = useState(routes[0]!);
  const [selectedBus, setSelectedBus] = useState("");
  const [eventState, setEventState] = useState<Record<CityDisruptionType, boolean>>({
    bandh: false,
    waterlogging: false,
    roadwork: false,
    vip_movement: false,
    exam_surge: false,
  });
  const [notice, setNotice] = useState("");

  const standbyBuses = fleetBuses.filter((bus) => bus.status === "standby");
  const breakdownBuses = fleetBuses.filter((bus) => bus.status === "breakdown");

  const fetchDepotData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [busResponse, feedbackResponse] = await Promise.all([
        supabase.from("buses").select("id, bus_number, route_id, status"),
        supabase.from("feedback").select("id", { count: "exact", head: true }),
      ]);
      if (busResponse.error) throw busResponse.error;
      if (feedbackResponse.error) throw feedbackResponse.error;
      const liveFleet = (busResponse.data ?? []).map((bus) => ({
          id: bus.id as string,
          busNumber: bus.bus_number as string,
          routeId: (bus.route_id as string | null) ?? null,
          status: bus.status as string,
        }));
      setFleetBuses(liveFleet);
      setSelectedBus((current) =>
        current && liveFleet.some((bus) => bus.busNumber === current)
          ? current
          : liveFleet.find((bus) => bus.status === "standby")?.busNumber ?? "",
      );
      setFeedbackCount(feedbackResponse.count ?? 0);
      setIsOffline(false);
    } catch (error) {
      console.warn("Depot live data unavailable:", error);
      setFleetBuses([]);
      setFeedbackCount(0);
      setIsOffline(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    void fetchDepotData();
    const channel = supabase
      .channel("public:operator-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "buses" }, () => void fetchDepotData())
      .on("postgres_changes", { event: "*", schema: "public", table: "feedback" }, () => void fetchDepotData())
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setFleetBuses([]);
          setFeedbackCount(0);
          setIsOffline(true);
        }
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchDepotData, isAuthenticated]);

  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const badgeCode = officerCode.trim();
    if (!badgeCode) {
      setNotice("Enter an RTC officer badge ID or officer code.");
      return;
    }
    const { data: officer, error } = await supabase
      .from("officers")
      .select("badge_code, display_name")
      .eq("badge_code", badgeCode)
      .maybeSingle();
    if (error || !officer) {
      setIsAuthenticated(false);
      setNotice("Officer verification failed. Check the badge code and try again.");
      return;
    }
    setOfficerName(officer.display_name ?? badgeCode);
    setIsAuthenticated(true);
    setNotice(`Officer #${badgeCode} authenticated for Depot South.`);
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
    if (result.success) void fetchDepotData();
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
      {isOffline && (
        <div role="alert" className="rounded-2xl border border-amber/30 bg-amber/10 px-4 py-3 text-xs font-semibold text-amber">
          Live depot data unavailable. Fleet, breakdown, and feedback data are hidden.
        </div>
      )}
      <section className="bg-panel rounded-3xl p-5 border border-white/10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold tracking-widest uppercase text-lime bg-lime/10 px-3 py-1 rounded-full border border-lime/20">
              RTC Depot Administrative Controls
            </span>
            <h2 className="font-display font-bold text-xl tracking-tight mt-3">
              Officer #{officerCode} · {officerName} · Zone Depot South
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
            <p className="text-xs font-bold text-lime uppercase tracking-wider">Live Fleet</p>
            {isLoading && <p className="text-xs text-white/50">Loading live fleet...</p>}
            {!isLoading && !isOffline && fleetBuses.length === 0 && (
              <p className="text-xs text-white/50">No fleet data available.</p>
            )}
            {!isOffline && fleetBuses.map((bus) => (
              <div
                key={bus.busNumber}
                className="flex items-center justify-between gap-3 border-b border-white/10 pb-2 last:border-0 last:pb-0"
              >
                <div>
                  <p className="text-sm font-bold text-white">{bus.busNumber}</p>
                  <p className="text-[11px] text-white/50">{bus.routeId ?? "Unassigned route"}</p>
                </div>
                <span
                  className={`text-[10px] font-bold ${bus.status === "standby" ? "text-lime" : "text-amber"}`}
                >
                  {displayStatus(bus.status)}
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
                  .filter((bus) => bus.status === "standby" || bus.busNumber === selectedBus)
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
            <p className="text-sm text-white mt-1">{breakdownBuses.length} active incident(s)</p>
            <div className="mt-1 space-y-1">
              {breakdownBuses.map((bus) => (
                <p key={bus.id} className="text-[11px] text-white/60">
                  {bus.busNumber} · {bus.routeId ?? "Unassigned route"}
                </p>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-amber/20 bg-amber/10 p-3">
            <p className="text-[10px] uppercase tracking-wider text-amber font-bold">
              Driver / Conductor Feedback
            </p>
            <p className="text-sm text-white mt-1">{feedbackCount} reports awaiting audit</p>
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
    </div>
  );
}
