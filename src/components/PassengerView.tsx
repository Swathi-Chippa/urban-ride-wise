import { useCallback, useEffect, useState, type FormEvent } from "react";
import { registerCommuteIntent, type CommuteIntentResult } from "@/lib/transitBrain";
import { supabase } from "@/lib/supabase";

export interface PassengerViewProps {
  active?: string[];
}
export interface CommuterRegistration {
  userType: string;
  passengerName: string;
  passIdOrPhone: string;
  originHub: string;
  destinationHub: string;
  routeId: string;
  timeSlot: string;
}
export interface FeedbackReport {
  category: string;
  busNumber: string;
  rating: number;
  comments: string;
  submittedAt: string;
}
export interface LiveBus {
  id: string;
  name: string;
  origin: string;
  destination: string;
  scheduled: string;
  actual: string;
  delay: string;
  busNo: string;
  eta: string;
  crowdLevel: string;
  crowdBadge: string;
  recommended: boolean;
  isVerified?: boolean;
  is_verified: boolean;
  occupancy: string;
}

const userCategories = ["Student", "Working Professional", "Daily Commuter"];
const routeChoices = ["Route 218", "Route 113", "Route 7"];
const timeSlotChoices = ["08:00 AM - 09:00 AM Peak", "05:00 PM - 06:00 PM Peak"];
const feedbackCategories = [
  "Driver Behavior",
  "Conductor Conduct",
  "Bus Cleanliness/Condition",
  "Severe Delay/Overcrowding",
];
const inputClassName =
  "mt-1.5 w-full rounded-xl border border-white/10 bg-panel2 px-3.5 py-3 text-sm text-white outline-none transition focus:border-lime/50";

export function PassengerView({ active = [] }: PassengerViewProps) {
  const [profile, setProfile] = useState<CommuterRegistration | null>(null);
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);
  const [profileForm, setProfileForm] = useState<CommuterRegistration>({
    userType: userCategories[0]!,
    passengerName: "",
    passIdOrPhone: "",
    originHub: "Ameerpet X Roads",
    destinationHub: "CBIT / Gandipet Campus",
    routeId: routeChoices[0]!,
    timeSlot: timeSlotChoices[0]!,
  });
  const [demand, setDemand] = useState<CommuteIntentResult["metrics"]>({
    totalDemand: 184,
    activeBusesCount: 2,
    routeId: "Route 218",
    timeSlot: "Morning Peak",
    activeRegistrations: 184,
    threshold: 150,
    highDemand: true,
  });
  const [demandTriggerStatus, setDemandTriggerStatus] = useState(
    "High demand detected; RTC Depot notified for extra bus allocation.",
  );
  const [isRegistering, setIsRegistering] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackReport | null>(null);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedbackForm, setFeedbackForm] = useState({
    category: feedbackCategories[0]!,
    busNumber: "TS09Z1234",
    rating: 0,
    comments: "",
  });

  const [routes, setRoutes] = useState<LiveBus[]>([
    {
      id: "218",
      name: "Route 218 · Express",
      origin: "Ameerpet X Roads",
      destination: "CBIT / Gandipet Campus",
      scheduled: "08:20 AM",
      actual: "08:32 AM",
      delay: "+12 MIN DELAY",
      isVerified: true,
      is_verified: true,
      occupancy: "High",
      busNo: "TS09Z1234",
      eta: "8 min",
      crowdLevel: "High Crowding Predicted (88%)",
      crowdBadge: "high",
      recommended: true,
    },
    {
      id: "113",
      name: "Route 113 · Local",
      origin: "Koti Bus Stop",
      destination: "CBIT College via Mehdipatnam",
      scheduled: "08:25 AM",
      actual: "08:26 AM",
      delay: "ON TIME",
      isVerified: false,
      is_verified: false,
      occupancy: "Moderate",
      busNo: "TS09Z5678",
      eta: "14 min",
      crowdLevel: "Moderate Crowding (45%)",
      crowdBadge: "medium",
      recommended: false,
    },
  ]);

  const fetchBusesAndDemand = useCallback(async () => {
    try {
      const { data: buses } = await supabase.from("buses").select("*");
      if (buses?.length) {
        setRoutes((current) =>
          current.map((bus) => {
            const liveBus = buses.find((row) => row.bus_number === bus.busNo) as
              { is_verified?: boolean; occupancy?: string } | undefined;
            return liveBus
              ? {
                  ...bus,
                  isVerified: liveBus.is_verified === true,
                  is_verified: liveBus.is_verified === true,
                  occupancy: liveBus.occupancy ?? bus.occupancy,
                }
              : bus;
          }),
        );
      }

      const { count } = await supabase
        .from("commuter_intent")
        .select("id", { count: "exact", head: true })
        .eq("route_id", demand.routeId);
      if (typeof count === "number") {
        setDemand((current) => ({
          ...current,
          totalDemand: count,
          activeRegistrations: count,
          highDemand: count > current.threshold,
        }));
      }
    } catch (error) {
      console.warn("Live bus fetch unavailable; retaining current view:", error);
    }
  }, [demand.routeId]);

  useEffect(() => {
    void fetchBusesAndDemand();
    const channel = supabase
      .channel("public:buses-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "buses" },
        () => void fetchBusesAndDemand(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchBusesAndDemand]);

  function openRegistration() {
    if (profile) setProfileForm(profile);
    setIsRegistrationOpen(true);
  }
  async function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfile(profileForm);
    setIsRegistering(true);
    const result = await registerCommuteIntent({
      userType: profileForm.userType,
      routeId: profileForm.routeId,
      timeSlot: profileForm.timeSlot,
    });
    setDemand(result.metrics);
    setDemandTriggerStatus(result.triggerStatus);
    setIsRegistering(false);
    setIsRegistrationOpen(false);
  }
  function submitFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!feedbackForm.rating) return;
    setFeedback({ ...feedbackForm, submittedAt: new Date().toISOString() });
    setFeedbackSubmitted(true);
    setFeedbackForm({
      category: feedbackCategories[0]!,
      busNumber: "TS09Z1234",
      rating: 0,
      comments: "",
    });
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-panel rounded-3xl p-6 border border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-bold tracking-widest uppercase text-lime bg-lime/10 px-3 py-1 rounded-full border border-lime/20">
              🎓 Student Commute Portal
            </span>
            <h2 className="font-display font-bold text-2xl tracking-tight mt-2">
              Commuter Travel Registration
            </h2>
          </div>
          <span className="size-3 rounded-full bg-lime animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <div className="bg-panel2 p-3.5 rounded-2xl border border-white/10">
            <p className="text-[10px] text-white/50 uppercase tracking-wider font-semibold">
              Origin Hub
            </p>
            <p className="text-sm font-bold text-white mt-0.5">Ameerpet X Roads</p>
          </div>
          <div className="bg-panel2 p-3.5 rounded-2xl border border-white/10">
            <p className="text-[10px] text-white/50 uppercase tracking-wider font-semibold">
              Destination Campus
            </p>
            <p className="text-sm font-bold text-white mt-0.5">City Transit Corridor</p>
          </div>
        </div>
        {profile ? (
          <div className="bg-lime/10 border border-lime/30 p-4 rounded-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-lime uppercase tracking-wider">
                  Registered Commuter
                </p>
                <p className="text-lg font-display font-bold text-white mt-1">
                  {profile.passengerName}
                </p>
                <p className="text-xs text-white/65 mt-1">
                  {profile.userType} · {profile.passIdOrPhone}
                </p>
                <p className="text-xs text-white/65 mt-1">
                  {profile.routeId} · {profile.timeSlot}
                </p>
                <p className="text-xs text-white/65 mt-1">
                  {profile.originHub} → {profile.destinationHub}
                </p>
              </div>
              <button
                type="button"
                onClick={openRegistration}
                className="text-xs font-bold text-lime hover:text-white transition-colors"
              >
                Edit Details
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-lime/10 border border-lime/30 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-lime">Commuter Travel Registration</p>
              <p className="text-xs text-white/70">
                Register your travel intent so the depot can forecast demand before departure.
              </p>
            </div>
            <button
              type="button"
              onClick={openRegistration}
              className="px-5 py-2.5 rounded-xl bg-lime text-ink font-display font-bold text-xs hover:bg-lime/90 transition-all whitespace-nowrap"
            >
              Register Commute Intent
            </button>
          </div>
        )}
        <div className="bg-panel2 border border-white/10 p-4 rounded-2xl space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <p className="text-xs text-white/50 uppercase tracking-wider font-semibold">
                Live Demand Counter
              </p>
              <p className="text-sm font-bold text-white mt-1">
                {demand.activeRegistrations} Commuters Registered for {demand.routeId} (
                {demand.timeSlot})
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-lime">
              Threshold {demand.threshold}
            </span>
          </div>
          {demand.highDemand && (
            <div className="rounded-xl border border-amber/30 bg-amber/10 px-3 py-2 text-xs font-semibold text-amber">
              High Demand Spike Detected: RTC Depot notified for extra bus allocation.
            </div>
          )}
          <p className="text-[11px] text-white/45">{demandTriggerStatus}</p>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-display font-bold text-lg tracking-tight text-white/90">
          Available Campus Corridor Buses
        </h3>
        {routes.map((bus) => (
          <div
            key={bus.id}
            className={`p-6 rounded-3xl border transition-all ${bus.recommended ? "bg-panel border-lime/40 shadow-lg shadow-lime/5" : "bg-panel/70 border-white/10"}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                {bus.recommended && (
                  <span className="text-[10px] font-extrabold uppercase tracking-widest bg-lime text-ink px-2.5 py-0.5 rounded-full">
                    BEST CHOICE
                  </span>
                )}
                <span
                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${bus.is_verified ? "bg-lime/20 text-lime border-lime/30" : "bg-white/10 text-white/60 border-white/10"}`}
                >
                  {bus.isVerified ? "● CONDUCTOR VERIFIED LIVE" : "○ UNVERIFIED SCHEDULE"}
                </span>
              </div>
              <span className="text-xs font-mono font-semibold text-white/50">{bus.busNo}</span>
            </div>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h4 className="font-display font-bold text-xl text-white">{bus.name}</h4>
                <p className="text-xs text-white/60 mt-0.5">
                  {bus.origin} ➔ {bus.destination}
                </p>
              </div>
              <div className="text-right">
                <span className="font-display font-black text-2xl text-lime">{bus.eta}</span>
                <p className="text-[10px] text-white/40 uppercase">ETA</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-panel2 p-3 rounded-2xl border border-white/10 text-xs mb-4">
              <div>
                <span className="text-[10px] text-white/40 block">Scheduled</span>
                <span className="font-mono font-bold text-white/80">{bus.scheduled}</span>
              </div>
              <div>
                <span className="text-[10px] text-white/40 block">Actual Expected</span>
                <span className="font-mono font-bold text-lime">{bus.actual}</span>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <span className="text-[10px] text-white/40 block">Delay Status</span>
                <span
                  className={`font-mono font-bold text-xs ${bus.delay.includes("DELAY") ? "text-amber" : "text-lime"}`}
                >
                  {bus.delay}
                </span>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2">
                <span
                  className={`size-2 rounded-full ${bus.crowdBadge === "high" ? "bg-amber animate-pulse" : "bg-lime"}`}
                />
                <span
                  className={`text-xs font-semibold ${bus.crowdBadge === "high" ? "text-amber" : "text-lime"}`}
                >
                  {bus.occupancy || bus.crowdLevel}
                </span>
              </div>
              <button
                type="button"
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-lime text-ink font-display font-bold text-xs hover:bg-lime/90 transition-all"
              >
                Board This Bus
              </button>
            </div>
          </div>
        ))}
      </div>

      <section className="bg-panel rounded-3xl p-6 border border-white/10 space-y-4">
        <div>
          <h3 className="font-display font-bold text-lg text-white">Report Issue / Feedback</h3>
          <p className="text-xs text-white/55 mt-1">
            Help us improve the student commute experience.
          </p>
        </div>
        {feedbackSubmitted && (
          <div
            role="status"
            className="rounded-2xl border border-lime/30 bg-lime/10 px-4 py-3 text-sm font-semibold text-lime"
          >
            Feedback Submitted to Depot Operations Audit Log
          </div>
        )}
        <form onSubmit={submitFeedback} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-white/70">
              Feedback Category
              <select
                className={inputClassName}
                value={feedbackForm.category}
                onChange={(event) =>
                  setFeedbackForm({ ...feedbackForm, category: event.target.value })
                }
              >
                {feedbackCategories.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-white/70">
              Bus Number
              <input
                required
                className={inputClassName}
                value={feedbackForm.busNumber}
                onChange={(event) =>
                  setFeedbackForm({ ...feedbackForm, busNumber: event.target.value })
                }
                placeholder="TS09Z1234"
              />
            </label>
          </div>
          <fieldset>
            <legend className="text-xs font-semibold text-white/70">Rating</legend>
            <div className="flex gap-1 mt-2">
              {[1, 2, 3, 4, 5].map((rating) => (
                <button
                  key={rating}
                  type="button"
                  aria-label={`${rating} star${rating > 1 ? "s" : ""}`}
                  onClick={() => setFeedbackForm({ ...feedbackForm, rating })}
                  className={`text-2xl transition-colors ${rating <= feedbackForm.rating ? "text-lime" : "text-white/25 hover:text-lime/70"}`}
                >
                  ★
                </button>
              ))}
            </div>
          </fieldset>
          <label className="block text-xs font-semibold text-white/70">
            Comments / Description
            <textarea
              required
              rows={3}
              className={`${inputClassName} resize-y`}
              value={feedbackForm.comments}
              onChange={(event) =>
                setFeedbackForm({ ...feedbackForm, comments: event.target.value })
              }
              placeholder="Tell us what happened..."
            />
          </label>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-lime text-ink font-display font-bold text-xs hover:bg-lime/90 transition-all"
            >
              Submit Report
            </button>
            {feedback && (
              <p className="text-xs text-lime">
                Report saved · {new Date(feedback.submittedAt).toLocaleString()}
              </p>
            )}
          </div>
        </form>
        {feedback && (
          <div className="rounded-2xl border border-white/10 bg-panel2 p-3 text-xs text-white/65">
            <span className="font-bold text-white">Latest report:</span> {feedback.category} ·{" "}
            {feedback.busNumber} · {feedback.rating}/5
          </div>
        )}
      </section>

      {isRegistrationOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="registration-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsRegistrationOpen(false);
          }}
        >
          <form
            onSubmit={submitProfile}
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-panel rounded-3xl border border-white/10 p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id="registration-title" className="font-display font-bold text-xl text-white">
                  Commuter Travel Registration
                </h3>
                <p className="text-xs text-white/55 mt-1">
                  Register your expected journey and help the depot plan capacity.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close registration"
                onClick={() => setIsRegistrationOpen(false)}
                className="text-white/50 hover:text-white text-xl"
              >
                ×
              </button>
            </div>
            <fieldset>
              <legend className="text-xs font-semibold text-white/70">User Category</legend>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                {userCategories.map((category) => (
                  <label
                    key={category}
                    className={`cursor-pointer rounded-xl border px-3 py-2 text-xs font-semibold transition ${profileForm.userType === category ? "border-lime/50 bg-lime/10 text-lime" : "border-white/10 bg-panel2 text-white/60"}`}
                  >
                    <input
                      type="radio"
                      name="userType"
                      value={category}
                      checked={profileForm.userType === category}
                      onChange={(event) =>
                        setProfileForm({ ...profileForm, userType: event.target.value })
                      }
                      className="sr-only"
                    />
                    {category}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="block text-xs font-semibold text-white/70">
              Passenger Name
              <input
                required
                className={inputClassName}
                value={profileForm.passengerName}
                onChange={(event) =>
                  setProfileForm({ ...profileForm, passengerName: event.target.value })
                }
              />
            </label>
            <label className="block text-xs font-semibold text-white/70">
              Pass ID / Phone No
              <input
                required
                className={inputClassName}
                value={profileForm.passIdOrPhone}
                onChange={(event) =>
                  setProfileForm({ ...profileForm, passIdOrPhone: event.target.value })
                }
              />
            </label>
            <label className="block text-xs font-semibold text-white/70">
              Origin Hub
              <input
                required
                className={inputClassName}
                value={profileForm.originHub}
                onChange={(event) =>
                  setProfileForm({ ...profileForm, originHub: event.target.value })
                }
                placeholder="Ameerpet X Roads"
              />
            </label>
            <label className="block text-xs font-semibold text-white/70">
              Destination Hub
              <input
                required
                className={inputClassName}
                value={profileForm.destinationHub}
                onChange={(event) =>
                  setProfileForm({ ...profileForm, destinationHub: event.target.value })
                }
                placeholder="CBIT / Gandipet Campus"
              />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-xs font-semibold text-white/70">
                Route Corridor
                <select
                  className={inputClassName}
                  value={profileForm.routeId}
                  onChange={(event) =>
                    setProfileForm({ ...profileForm, routeId: event.target.value })
                  }
                >
                  {routeChoices.map((route) => (
                    <option key={route}>{route}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold text-white/70">
                Expected Time Window
                <select
                  className={inputClassName}
                  value={profileForm.timeSlot}
                  onChange={(event) =>
                    setProfileForm({ ...profileForm, timeSlot: event.target.value })
                  }
                >
                  {timeSlotChoices.map((timeSlot) => (
                    <option key={timeSlot}>{timeSlot}</option>
                  ))}
                </select>
              </label>
            </div>
            <button
              type="submit"
              className="w-full rounded-xl bg-lime py-3 text-sm font-display font-bold text-ink hover:bg-lime/90 transition-all"
            >
              {isRegistering ? "Registering Intent..." : "Register Commute Intent"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
