import { useState, type FormEvent } from "react";
import {
  registerConductorShift,
  reportConductorEvent,
  updateBusOccupancy,
  type OccupancyStatus,
} from "@/lib/transitBrain";

export interface ConductorShiftForm {
  name: string;
  employeeId: string;
  busNumber: string;
  routeId: string;
  fitnessCheck: "Passed" | "Needs Review";
}

const routeChoices = ["Route 218", "Route 113", "Route 7"];
const occupancyChoices: OccupancyStatus[] = ["Low", "Moderate", "Overcrowded (Surge)"];
const inputClassName =
  "mt-1.5 w-full rounded-xl border border-white/10 bg-panel2 px-3.5 py-3 text-sm text-white outline-none transition focus:border-lime/50";

export function ConductorView() {
  const [shift, setShift] = useState<ConductorShiftForm | null>(null);
  const [form, setForm] = useState<ConductorShiftForm>({
    name: "",
    employeeId: "",
    busNumber: "TS09Z1234",
    routeId: routeChoices[0]!,
    fitnessCheck: "Passed",
  });
  const [occupancy, setOccupancy] = useState<OccupancyStatus>("Low");
  const [isBreakdown, setIsBreakdown] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [notice, setNotice] = useState("");

  async function startShift(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (form.fitnessCheck !== "Passed") {
      setNotice("Fitness check must be passed before the bus can be verified.");
      return;
    }
    const result = await registerConductorShift({
      conductorId: form.employeeId,
      name: form.name,
      busNumber: form.busNumber,
      routeId: form.routeId,
    });
    if (result.success) {
      setShift(form);
      setNotice(result.message);
      setLogs((current) => [result.message, ...current]);
    }
  }

  async function updateOccupancy(next: OccupancyStatus) {
    if (!shift) return;
    setOccupancy(next);
    const result = await updateBusOccupancy(shift.busNumber, next);
    setNotice(result.message);
    setLogs((current) => [result.message, ...current]);
  }

  async function handleEmergency(eventType: "BREAKDOWN" | "ROAD_BLOCK" | "END_SHIFT") {
    if (!shift) return;
    const result = await reportConductorEvent(shift.busNumber, eventType);
    setNotice(result.message);
    setLogs((current) => [result.message, ...current]);
    if (eventType === "BREAKDOWN") setIsBreakdown(true);
    if (eventType === "END_SHIFT") setShift(null);
  }

  if (!shift) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <section className="bg-panel rounded-3xl p-6 border border-white/10 space-y-5">
          <div className="border-b border-white/10 pb-4">
            <span className="text-xs font-bold tracking-widest uppercase text-lime bg-lime/10 px-3 py-1 rounded-full border border-lime/20">
              Conductor Portal
            </span>
            <h2 className="font-display font-bold text-2xl tracking-tight mt-3">
              Shift Onboarding
            </h2>
            <p className="text-xs text-white/50 mt-1">
              Verify your identity, bus fitness, and assigned corridor before departure.
            </p>
          </div>
          <form onSubmit={startShift} className="space-y-4">
            <label className="block text-xs font-semibold text-white/70">
              Conductor Name
              <input
                required
                className={inputClassName}
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </label>
            <label className="block text-xs font-semibold text-white/70">
              Employee ID
              <input
                required
                className={inputClassName}
                value={form.employeeId}
                onChange={(event) => setForm({ ...form, employeeId: event.target.value })}
                placeholder="RTC-4092"
              />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-xs font-semibold text-white/70">
                Bus Registration No
                <input
                  required
                  className={inputClassName}
                  value={form.busNumber}
                  onChange={(event) => setForm({ ...form, busNumber: event.target.value })}
                  placeholder="TS09Z1234"
                />
              </label>
              <label className="text-xs font-semibold text-white/70">
                Assigned Route
                <select
                  className={inputClassName}
                  value={form.routeId}
                  onChange={(event) => setForm({ ...form, routeId: event.target.value })}
                >
                  {routeChoices.map((route) => (
                    <option key={route}>{route}</option>
                  ))}
                </select>
              </label>
            </div>
            <fieldset>
              <legend className="text-xs font-semibold text-white/70">Fuel / Fitness Check</legend>
              <div className="flex gap-2 mt-2">
                <label
                  className={`flex-1 cursor-pointer rounded-xl border px-3 py-3 text-xs font-semibold ${form.fitnessCheck === "Passed" ? "border-lime/50 bg-lime/10 text-lime" : "border-white/10 bg-panel2 text-white/60"}`}
                >
                  <input
                    type="radio"
                    className="sr-only"
                    checked={form.fitnessCheck === "Passed"}
                    onChange={() => setForm({ ...form, fitnessCheck: "Passed" })}
                  />
                  ✓ Passed
                </label>
                <label
                  className={`flex-1 cursor-pointer rounded-xl border px-3 py-3 text-xs font-semibold ${form.fitnessCheck === "Needs Review" ? "border-amber/50 bg-amber/10 text-amber" : "border-white/10 bg-panel2 text-white/60"}`}
                >
                  <input
                    type="radio"
                    className="sr-only"
                    checked={form.fitnessCheck === "Needs Review"}
                    onChange={() => setForm({ ...form, fitnessCheck: "Needs Review" })}
                  />
                  Needs Review
                </label>
              </div>
            </fieldset>
            <button
              type="submit"
              className="w-full rounded-xl bg-lime py-3 text-sm font-display font-bold text-ink hover:bg-lime/90 transition-all"
            >
              Start Shift &amp; Verify Bus
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
        {logs.length > 0 && <LogPanel logs={logs} />}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <section className="bg-panel rounded-3xl p-6 border border-white/10 space-y-5">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <span className="text-xs font-bold tracking-widest uppercase text-lime bg-lime/10 px-3 py-1 rounded-full border border-lime/20">
              Verified Conductor Portal
            </span>
            <h2 className="font-display font-bold text-2xl tracking-tight mt-3">
              {shift.busNumber} · {shift.routeId}
            </h2>
            <p className="text-xs text-white/50 mt-1">
              {shift.name} · Employee {shift.employeeId}
            </p>
          </div>
          <span
            className={`px-3 py-1.5 rounded-full text-xs font-bold ${isBreakdown ? "bg-red-500/20 text-red-400 border border-red-500/30" : "bg-lime/20 text-lime border border-lime/30"}`}
          >
            {isBreakdown ? "BREAKDOWN REPORTED" : "● VERIFIED LIVE"}
          </span>
        </div>
        <div>
          <p className="text-xs text-white/50 uppercase tracking-wider font-semibold">
            Live Occupancy Status
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
            {occupancyChoices.map((choice) => (
              <button
                key={choice}
                type="button"
                onClick={() => updateOccupancy(choice)}
                className={`rounded-xl border px-3 py-3 text-xs font-bold transition ${occupancy === choice ? "border-lime/50 bg-lime text-ink" : "border-white/10 bg-panel2 text-white/65 hover:border-lime/40"}`}
              >
                {choice}
              </button>
            ))}
          </div>
          <p className="text-xs text-white/50 mt-2">
            Current status: <span className="font-bold text-lime">{occupancy}</span>
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => handleEmergency("BREAKDOWN")}
            disabled={isBreakdown}
            className="rounded-xl border border-red-500/30 bg-red-600/15 px-3 py-3 text-xs font-bold text-red-300 hover:bg-red-600/25 disabled:opacity-50"
          >
            Report Breakdown
          </button>
          <button
            type="button"
            onClick={() => handleEmergency("ROAD_BLOCK")}
            className="rounded-xl border border-amber/30 bg-amber/10 px-3 py-3 text-xs font-bold text-amber hover:bg-amber/20"
          >
            Report Road Block
          </button>
          <button
            type="button"
            onClick={() => handleEmergency("END_SHIFT")}
            className="rounded-xl border border-white/10 bg-panel2 px-3 py-3 text-xs font-bold text-white/70 hover:border-lime/40"
          >
            End Shift
          </button>
        </div>
        {notice && (
          <p
            role="status"
            className="rounded-xl border border-lime/30 bg-lime/10 p-3 text-xs text-lime"
          >
            {notice}
          </p>
        )}
      </section>
      <LogPanel logs={logs} />
    </div>
  );
}

function LogPanel({ logs }: { logs: string[] }) {
  return (
    <section className="bg-panel rounded-3xl p-6 border border-white/10 space-y-3">
      <h3 className="font-display font-bold text-lg tracking-tight">
        Audit &amp; Verification Log
      </h3>
      <div className="space-y-2">
        {logs.length === 0 ? (
          <p className="text-xs text-white/40">No shift events recorded yet.</p>
        ) : (
          logs.map((log, index) => (
            <div
              key={`${log}-${index}`}
              className="bg-panel2/60 p-3 rounded-xl border border-white/10 text-xs font-mono text-white/80"
            >
              {log}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
