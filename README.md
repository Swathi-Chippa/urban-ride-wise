# BusMitra AI

A real-time, conductor-verified transit intelligence platform for urban bus corridors  built for Hack Devengers 2.0.

**Live demo:** [add deployed link if available]
**Repo:** https://github.com/Swathi-Chippa/urban-ride-wise

---

## The Problem

Commuters on routes like Ameerpet  CBIT have no reliable way to know whether a bus is actually running, how crowded it is, or whether it will show up at all. Existing transit apps show static schedules, not ground truth. Drivers and conductors have no lightweight way to report real-time status, and depots have no live view of their fleet.

## What BusMitra AI Does

BusMitra AI closes the loop between three roles:

- **Commuters** register travel intent and see live, conductor-verified bus status  not just a static schedule.
- **Conductors** start/end shifts, update live occupancy, and report breakdowns from a simple mobile-friendly portal.
- **Depot officers** see the real fleet state, manually reallocate buses, and toggle city-wide disruptions (rain, exam surges, road closures) that automatically trigger standby bus dispatch.

When a bus breaks down, the system automatically finds and dispatches a standby replacement to the correct route  atomically, with no risk of two dispatch events grabbing the same bus.

---

## Architecture

- **Frontend:** React + TypeScript + Vite (TanStack Start), Tailwind CSS
- **Backend:** Supabase (Postgres + Realtime + Row Level Security)
- **Live sync:** `postgres_changes` subscriptions push bus state changes to every connected client within ~1-2 seconds, no polling or manual refresh
- **Atomic dispatch:** All state-changing operations (starting a shift, reporting a breakdown, dispatching a standby bus) go through `SECURITY DEFINER` Postgres functions using `FOR UPDATE SKIP LOCKED`, not client-side read-then-write logic  this is what prevents two simultaneous events from double-booking the same bus

### Database schema

| Table | Purpose |
|---|---|
| `buses` | Live fleet state: status, route, verification, occupancy |
| `routes` | Route metadata: baseline ETA, crowding, demand |
| `city_signals` | Disruption events (rain, roadwork, exam surge, etc.) and their route multipliers |
| `commuter_intent` | Passenger-registered travel intent, used for demand forecasting |
| `feedback` | Rider reports on driver/conductor/vehicle issues |
| `officers` | Depot officer badge codes for authentication |

Key functions: `dispatch_standby()`, `allocate_bus_by_number()`, `start_conductor_shift()`, `end_conductor_shift()`, `report_bus_breakdown()`, `update_bus_occupancy()`  all run as `SECURITY DEFINER` to safely bypass RLS for validated, atomic state transitions.

---

## Setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL Editor (idempotent  safe to re-run before real data is collected; **do not re-run after seeding real feedback/production data**, since three tables are dropped and recreated on each run).
3. Copy `.env.example` to `.env` and fill in your project's URL and anon key:

VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key

4. Install dependencies and run:

npm install
npm run dev

5. Open `localhost:8080` (or the port Vite reports).

---

## Development Process

The initial UI scaffold was generated with Lovable. From there, the team audited it against a live database and found the majority of the "real-time" and "verified" claims in the original scaffold were cosmetic  hardcoded data, no actual writes, and a client-side auth check that accepted any 4+ character string.

**Issues found and fixed during the hackathon:**
- The realtime layer was entirely disconnected  UI displayed hardcoded bus data, not live database reads
- Bus dispatch used a non-atomic select-then-update pattern, vulnerable to race conditions under concurrent load
- Row Level Security allowed reads but silently blocked writes  conductor and depot actions appeared to succeed in the UI (Supabase's `.update()` returns `error: null` even when zero rows match) while nothing was actually written to the database
- Depot login accepted any string 4+ characters long
- Manual bus allocation had no check that the target bus was actually available, risking double-dispatch

**What was built and verified against a live Supabase project (not just locally):**
- Atomic dispatch via `FOR UPDATE SKIP LOCKED`, load-tested with 10 concurrent requests confirming zero double-assignment
- `SECURITY DEFINER` RPC functions for every state-changing operation, replacing unsafe direct client writes
- Live `postgres_changes` subscriptions syncing bus state across commuter, conductor, and depot views in real time
- Real officer authentication against a database table
- Every write path checks its actual affected-row count, not just the absence of an error

---

## Known Limitations

Being transparent about what's simplified given the 24-hour window:

- **Auth:** Officer login is a lightweight badge-code lookup against a table, not full Supabase Auth with sessions/roles. Fine for a demo; would need hardening for production.
- **ETAs:** Estimated from static route metadata (base ETA + crowding), not live GPS or traffic data.
- **RLS on `buses`:** Anon key has read access to all buses; writes go exclusively through validated RPC functions rather than table-level RLS policies, since RLS proved insufficient to express the state-machine rules cleanly within the time available.
- **No persistent audit log:** Dispatch and conductor actions update state but aren't logged to a separate audit trail.
- **Single depot/zone:** The system models one depot ("Depot South") and three routes; not yet multi-depot.

## Roadmap

- Full Supabase Auth for officer/conductor accounts
- GPS-based live ETAs
- Persistent audit/event log for dispatch decisions
- Multi-depot support
- Passenger-side push notifications on verified bus arrival

---

## Tech Stack

React  TypeScript  Vite  TanStack Start  Tailwind CSS  Supabase (Postgres, Realtime, RLS)
