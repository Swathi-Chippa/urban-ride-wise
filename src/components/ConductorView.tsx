import React, { useState } from "react";
import { reportConductorEvent, updateBusOccupancy } from "../lib/transitBrain";

export function ConductorView() {
  const [isShiftActive, setIsShiftActive] = useState(false);
  const [conductorName, setConductorName] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [busNumber, setBusNumber] = useState("TS09Z1234");
  const [routeId, setRouteId] = useState("Route 218");
  const [occupancy, setOccupancy] = useState<"Low" | "Moderate" | "Overcrowded">("Low");
  const [preTripConfirmed, setPreTripConfirmed] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleStartShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId || !busNumber || !preTripConfirmed) return;

    const result = await reportConductorEvent(busNumber, "TRIP_START", employeeId, routeId);
    console.log("[ConductorView] TRIP_START result:", result);
    if (!result.success) {
      setErrorMessage(result.message);
      return;
    }
    setErrorMessage("");
    setIsShiftActive(true);
  };

  const handleOccupancyChange = async (level: "Low" | "Moderate" | "Overcrowded") => {
    const result = await updateBusOccupancy(busNumber, level);
    if (!result.success) {
      setErrorMessage(result.message);
      return;
    }
    setErrorMessage("");
    setOccupancy(level);
  };

  const handleBreakdown = async () => {
    const result = await reportConductorEvent(busNumber, "BREAKDOWN", employeeId);
    console.log("[ConductorView] BREAKDOWN result:", result);
    if (!result.success) {
      setErrorMessage(result.message);
      return;
    }
    setErrorMessage("");
    alert("Emergency Breakdown reported. Replacement fleet dispatched by Depot.");
  };

  const handleEndShift = async () => {
    const result = await reportConductorEvent(busNumber, "END_SHIFT", employeeId);
    console.log("[ConductorView] END_SHIFT result:", result);
    if (!result.success) {
      setErrorMessage(result.message);
      return;
    }
    setErrorMessage("");
    setIsShiftActive(false);
  };

  return (
    <div className="p-6 bg-panel text-white rounded-xl border border-white/10 space-y-6">
      <h2 className="text-xl font-bold text-lime">🎫 Conductor Shift Verification Portal</h2>

      {errorMessage && (
        <div role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {errorMessage}
        </div>
      )}

      {!isShiftActive ? (
        <form
          onSubmit={handleStartShift}
          className="space-y-4 max-w-md bg-panel2 p-4 rounded-lg border border-white/10"
        >
          <h3 className="font-semibold text-sm">Morning Shift Onboarding</h3>
          <div>
            <label className="text-xs text-slate-400">Conductor Name</label>
            <input
              type="text"
              value={conductorName}
              onChange={(e) => setConductorName(e.target.value)}
              placeholder="Ramesh Kumar"
              className="w-full mt-1 bg-ink p-2 rounded text-sm border border-white/10"
              required
            />
          </div>
          <div>
            <label className="text-xs text-slate-400">Employee / Crew ID</label>
            <input
              type="text"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              placeholder="RTC-8821"
              className="w-full mt-1 bg-ink p-2 rounded text-sm border border-white/10"
              required
            />
          </div>
          <div>
            <label className="text-xs text-slate-400">Assigned Bus Number</label>
            <input
              type="text"
              value={busNumber}
              onChange={(e) => setBusNumber(e.target.value)}
              className="w-full mt-1 bg-ink p-2 rounded text-sm border border-white/10"
              required
            />
          </div>
          <div>
            <label className="text-xs text-slate-400">Assigned Route</label>
            <select
              value={routeId}
              onChange={(e) => setRouteId(e.target.value)}
              className="w-full mt-1 bg-ink p-2 rounded text-sm border border-white/10"
            >
              <option>Route 218</option>
              <option>Route 113</option>
              <option>Route 7</option>
            </select>
          </div>
          <label className="flex items-start gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={preTripConfirmed}
              onChange={(e) => setPreTripConfirmed(e.target.checked)}
              className="mt-0.5 accent-lime"
              required
            />
            <span>I confirm this vehicle has passed pre-trip inspection: brakes, tires, lights, fuel.</span>
          </label>
          <button
            type="submit"
            disabled={!preTripConfirmed}
            className="w-full py-2.5 bg-lime text-ink font-bold rounded hover:bg-lime/90 disabled:cursor-not-allowed disabled:opacity-50 transition text-sm"
          >
            Start Shift & Verify Bus Status
          </button>
        </form>
      ) : (
        <div className="space-y-6">
          <div className="p-4 bg-panel2 rounded-lg border border-lime/30 flex justify-between items-center">
            <div>
              <span className="text-xs text-slate-400">Shift Active</span>
              <div className="font-bold text-lg">
                {busNumber} ({routeId})
              </div>
              <div className="text-xs text-slate-400">
                Crew: {conductorName} ({employeeId})
              </div>
            </div>
            <span className="px-3 py-1 bg-lime/20 text-lime border border-lime/40 text-xs rounded-full font-bold animate-pulse">
              ● VERIFIED LIVE ON CITY MAP
            </span>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold">Update Live Passenger Occupancy:</label>
            <div className="flex gap-3">
              {(["Low", "Moderate", "Overcrowded"] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => handleOccupancyChange(level)}
                  className={`flex-1 py-2 rounded text-xs font-bold border transition ${
                    occupancy === level
                      ? "bg-lime text-ink border-lime"
                      : "bg-panel2 text-slate-300 border-white/10 hover:border-white/30"
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-white/10 flex gap-3">
            <button
              onClick={handleBreakdown}
              className="flex-1 py-2 bg-red-500/20 text-red-400 border border-red-500/40 font-bold rounded text-xs hover:bg-red-500/30"
            >
              ⚠️ Report Emergency Breakdown
            </button>
            <button
              onClick={handleEndShift}
              className="py-2 px-4 bg-panel2 text-slate-300 border border-white/10 rounded text-xs hover:bg-white/5"
            >
              End Shift
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
