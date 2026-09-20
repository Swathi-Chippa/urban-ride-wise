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

const signalNames: Partial<Record<CityDisruptionType, string>> = {
  bandh: "Bandh / Strike",
  waterlogging: "Heavy Rain / Waterlogging",
  roadwork: "Road Work / Construction Detour",
  vip_movement: "VIP Movement Freeze",
  exam_surge: "College Exam / Event Demand Surge",
};

export async function processCitySignal(
  signalName: CityDisruptionType,
  isActive: boolean,
): Promise<CitySignalResult | null> {
  try {
    const databaseSignalName = signalNames[signalName] ?? signalName;
    const { data: signalResult, error } = await supabase.rpc("apply_city_signal", {
      signal_name: databaseSignalName,
      is_active: isActive,
    });
    if (error || !signalResult) return null;

    const predictedDemand = Number(signalResult.predicted_demand);
    const zone = typeof signalResult.zone === "string" ? signalResult.zone : null;
    if (!Number.isFinite(predictedDemand) || !zone) return null;
    const standbyUnitsDispatched = signalResult.standby_bus_dispatched === true;

    return {
      success: true,
      message: `${databaseSignalName} ${isActive ? "activated" : "deactivated"}.`,
      zone,
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
): Promise<CommuteIntentResult | null> {
  const { data: intentResult, error } = await supabase.rpc("register_commute_intent", {
    user_type: data.userType,
    route_id: data.routeId,
    time_slot: data.timeSlot,
    phone: data.phone ?? "",
  });
  if (error || !intentResult) {
    console.warn("Live commuter intent registration unavailable:", error);
    return null;
  }

  const totalDemand = Number(intentResult.registration_count);
  if (!Number.isFinite(totalDemand)) return null;
  const thresholdCrossed = intentResult.threshold_crossed === true;
  const standbyRepositioned = intentResult.bus_dispatched === true;
  return {
    totalDemand,
    thresholdCrossed,
    metrics: {
      totalDemand,
      activeBusesCount: standbyRepositioned ? 2 : 1,
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
  routeId?: string,
): Promise<FleetActionResult> {
  try {
    if (eventType === "TRIP_START") {
      const { data, error } = await supabase.rpc("start_conductor_shift", {
        target_bus_number: busNumber,
        target_conductor_id: conductorId ?? "COND-UNKNOWN",
        target_route: routeId ?? "",
      });
      if (error) throw error;
      if (typeof data !== "string") {
        return {
          success: false,
          message: `${busNumber} is not available for shift start (must be standby or repositioning).`,
        };
      }
      return { success: true, message: `Bus ${busNumber} is Active and CONDUCTOR VERIFIED LIVE.` };
    }

    if (eventType === "END_SHIFT") {
      const { data, error } = await supabase.rpc("end_conductor_shift", {
        target_bus_number: busNumber,
      });
      if (error) throw error;
      if (typeof data !== "string") {
        return {
          success: false,
          message: `Unable to end shift for ${busNumber}; no matching active bus was found.`,
        };
      }
      return { success: true, message: `Shift ended for ${busNumber}; bus is Unverified.` };
    }

    const { data: updatedBreakdown, error: breakdownError } = await supabase.rpc(
      "report_bus_breakdown",
      { target_bus_number: busNumber },
    );
    if (breakdownError) throw breakdownError;
    if (typeof updatedBreakdown !== "string") {
      return {
        success: false,
        message: `Breakdown already reported or bus ${busNumber} is not in service.`,
      };
    }
    return {
      success: true,
      message: `Breakdown reported for ${busNumber}; standby dispatch evaluated by RTC Depot.`,
    };
  } catch (error) {
    console.error("Error reporting conductor event:", error);
    return { success: false, message: "Unable to update the bus in Supabase." };
  }
}

export async function markBusRepaired(busNumber: string): Promise<FleetActionResult> {
  try {
    const { data: repairedBusId, error } = await supabase.rpc("mark_bus_repaired", {
      target_bus_number: busNumber,
    });
    if (error) throw error;
    if (typeof repairedBusId !== "string") {
      return {
        success: false,
        message: `${busNumber} is not currently marked as breakdown.`,
      };
    }
    return { success: true, message: `${busNumber} marked as repaired and returned to standby.` };
  } catch (error) {
    console.error("Error marking bus repaired:", error);
    return { success: false, message: "Unable to mark the bus as repaired in Supabase." };
  }
}

export async function updateBusOccupancy(
  busNumber: string,
  occupancy: "Low" | "Moderate" | "Overcrowded" | "Overcrowded (Surge)",
): Promise<FleetActionResult> {
  try {
    const { data, error } = await supabase.rpc("update_bus_occupancy", {
      target_bus_number: busNumber,
      target_occupancy: occupancy,
    });
    if (error) throw error;
    if (typeof data !== "string") {
      return {
        success: false,
        message: `Unable to update occupancy; bus ${busNumber} was not found.`,
      };
    }
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
    const { data: allocatedBusId, error } = await supabase.rpc("allocate_bus_by_number", {
      target_bus_number: busNumber,
      target_route: targetRoute,
    });
    if (error) throw error;
    if (typeof allocatedBusId !== "string") {
      return {
        success: false,
        message: `${busNumber} is no longer standby or is unavailable for allocation.`,
      };
    }
    return { success: true, message: `${busNumber} allocated to ${targetRoute}.` };
  } catch (error) {
    console.error("Error allocating bus:", error);
    return { success: false, message: "Unable to allocate bus in Supabase." };
  }
}
