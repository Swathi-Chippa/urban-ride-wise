import { supabase } from "./supabase";

export type CityDisruptionType =
  "bandh" | "waterlogging" | "roadwork" | "vip_movement" | "exam_surge";

export interface CommuterIntentData {
  phone?: string;
  name?: string;
  userType: string;
  routeId: string;
  timeSlot: string;
}

export interface CommuteIntentResult {
  totalDemand: number;
  thresholdCrossed: boolean;
  metrics: {
    totalDemand: number;
    activeBusesCount: number;
    routeId: string;
    timeSlot: string;
    activeRegistrations: number;
    threshold: number;
    highDemand: boolean;
  };
  triggerStatus: string;
}

export interface CitySignalResult {
  success: boolean;
  message: string;
  zone: string;
  predictedDemand: number;
  standbyUnitsDispatched: boolean;
}

export interface FleetActionResult {
  success: boolean;
  message: string;
}

const DEMAND_THRESHOLD = 150;
const localDemand = new Map<string, number>([["Route 218|Morning Peak", 184]]);

const signalNames: Partial<Record<CityDisruptionType, string>> = {
  bandh: "Bandh / Strike",
  waterlogging: "Heavy Rain / Waterlogging",
  roadwork: "Road Work / Construction Detour",
  vip_movement: "VIP Movement Freeze",
  exam_surge: "College Exam / Event Demand Surge",
};

async function repositionStandbyBus(routeId: string): Promise<boolean> {
  const { data: standbyBuses, error: selectError } = await supabase
    .from("buses")
    .select("id")
    .eq("status", "Standby")
    .limit(1);
  const standbyId = standbyBuses?.[0]?.id;
  if (selectError || !standbyId) return false;

  const { error: updateError } = await supabase
    .from("buses")
    .update({ status: "Repositioning", route_id: routeId, updated_at: new Date().toISOString() })
    .eq("id", standbyId);
  return !updateError;
}

export async function processCitySignal(
  signalName: CityDisruptionType,
  isActive: boolean,
): Promise<CitySignalResult | null> {
  try {
    const databaseSignalName = signalNames[signalName] ?? signalName;
    const { data: signal, error: signalError } = await supabase
      .from("city_signals")
      .select("zone, multiplier")
      .eq("signal_name", databaseSignalName)
      .single();
    if (signalError || !signal) return null;

    const { data: route, error: routeError } = await supabase
      .from("routes")
      .select("id, baseline_demand")
      .eq("name", signal.zone)
      .single();
    if (routeError || !route) return null;

    const predictedDemand = isActive
      ? Math.round(route.baseline_demand * signal.multiplier)
      : route.baseline_demand;
    await supabase
      .from("city_signals")
      .update({ is_active: isActive })
      .eq("signal_name", databaseSignalName);
    await supabase.from("routes").update({ predicted_demand: predictedDemand }).eq("id", route.id);
    const standbyUnitsDispatched =
      predictedDemand > DEMAND_THRESHOLD ? await repositionStandbyBus(signal.zone) : false;

    return {
      success: true,
      message: `${databaseSignalName} ${isActive ? "activated" : "deactivated"}.`,
      zone: signal.zone,
      predictedDemand,
      standbyUnitsDispatched,
    };
  } catch (error) {
    console.error("Error processing city signal:", error);
    return null;
  }
}

export async function registerCommuteIntent(
  data: CommuterIntentData,
): Promise<CommuteIntentResult> {
  const demandKey = `${data.routeId}|${data.timeSlot}`;
  let totalDemand: number | null = null;
  try {
    const { error: insertError } = await supabase.from("commuter_intent").insert({
      phone: data.phone ?? `ANON-${Date.now()}`,
      passenger_name: data.name ?? "Anonymous Rider",
      user_type: data.userType,
      route_id: data.routeId,
      time_slot: data.timeSlot,
    });
    if (!insertError) {
      const { count, error: countError } = await supabase
        .from("commuter_intent")
        .select("id", { count: "exact", head: true })
        .eq("route_id", data.routeId)
        .eq("time_slot", data.timeSlot);
      if (!countError && typeof count === "number") totalDemand = count;
    }
  } catch (error) {
    console.warn("Using local commuter intent fallback:", error);
  }

  if (totalDemand === null) {
    totalDemand = (localDemand.get(demandKey) ?? 0) + 1;
    localDemand.set(demandKey, totalDemand);
  }

  const thresholdCrossed = totalDemand > DEMAND_THRESHOLD;
  const standbyRepositioned = thresholdCrossed ? await repositionStandbyBus(data.routeId) : false;
  return {
    totalDemand,
    thresholdCrossed,
    metrics: {
      totalDemand,
      activeBusesCount: thresholdCrossed ? 2 : 1,
      routeId: data.routeId,
      timeSlot: data.timeSlot,
      activeRegistrations: totalDemand,
      threshold: DEMAND_THRESHOLD,
      highDemand: thresholdCrossed,
    },
    triggerStatus: thresholdCrossed
      ? standbyRepositioned
        ? "CRITICAL DEMAND THRESHOLD REACHED (>150) — Standby Bus Repositioned!"
        : "CRITICAL DEMAND THRESHOLD REACHED (>150) — RTC Depot notified."
      : "Normal Route Demand Level",
  };
}

export async function reportConductorEvent(
  busNumber: string,
  eventType: "TRIP_START" | "BREAKDOWN" | "END_SHIFT",
  conductorId?: string,
): Promise<FleetActionResult> {
  try {
    if (eventType === "TRIP_START") {
      const { error } = await supabase
        .from("buses")
        .update({
          status: "Active",
          is_verified: true,
          conductor_id: conductorId ?? "COND-UNKNOWN",
          updated_at: new Date().toISOString(),
        })
        .eq("bus_number", busNumber);
      if (error) throw error;
      return { success: true, message: `Bus ${busNumber} is Active and CONDUCTOR VERIFIED LIVE.` };
    }

    if (eventType === "END_SHIFT") {
      const { error } = await supabase
        .from("buses")
        .update({ status: "Unverified", is_verified: false, updated_at: new Date().toISOString() })
        .eq("bus_number", busNumber);
      if (error) throw error;
      return { success: true, message: `Shift ended for ${busNumber}; bus is Unverified.` };
    }

    const { error: breakdownError } = await supabase
      .from("buses")
      .update({ status: "Breakdown", is_verified: false, updated_at: new Date().toISOString() })
      .eq("bus_number", busNumber);
    if (breakdownError) throw breakdownError;
    const standbyRepositioned = await repositionStandbyBus("Route 218");
    return {
      success: true,
      message: standbyRepositioned
        ? `Breakdown reported for ${busNumber}; standby replacement repositioned.`
        : `Breakdown reported for ${busNumber}; RTC Depot notified.`,
    };
  } catch (error) {
    console.error("Error reporting conductor event:", error);
    return { success: false, message: "Unable to update the bus in Supabase." };
  }
}

export async function updateBusOccupancy(
  busNumber: string,
  occupancy: "Low" | "Moderate" | "Overcrowded" | "Overcrowded (Surge)",
): Promise<FleetActionResult> {
  try {
    const { error } = await supabase
      .from("buses")
      .update({ occupancy, updated_at: new Date().toISOString() })
      .eq("bus_number", busNumber);
    if (error) throw error;
    return { success: true, message: `Live occupancy updated to ${occupancy}.` };
  } catch (error) {
    console.error("Error updating occupancy:", error);
    return { success: false, message: "Unable to update live occupancy in Supabase." };
  }
}

export async function manuallyAllocateBus(
  busNumber: string,
  targetRoute: string,
): Promise<FleetActionResult> {
  try {
    const { error } = await supabase
      .from("buses")
      .update({
        status: "Repositioning",
        route_id: targetRoute,
        updated_at: new Date().toISOString(),
      })
      .eq("bus_number", busNumber);
    if (error) throw error;
    return { success: true, message: `${busNumber} allocated to ${targetRoute}.` };
  } catch (error) {
    console.error("Error allocating bus:", error);
    return { success: false, message: "Unable to allocate bus in Supabase." };
  }
}
