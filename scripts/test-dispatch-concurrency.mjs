import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  fs
    .readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.trim().startsWith("#"))
    .map((line) => {
      const separator = line.indexOf("=");
      const key = line.slice(0, separator).trim();
      const value = line
        .slice(separator + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
      return [key, value];
    }),
);

const supabase = createClient(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  },
);

const results = await Promise.all(
  Array.from({ length: 10 }, (_, index) =>
    supabase.rpc("dispatch_standby", { target_route: "Route 218" }).then(
      ({ data, error }) => ({
        call: index + 1,
        busId: data ?? null,
        error: error
          ? {
              message: error.message,
              code: error.code,
              details: error.details,
              hint: error.hint,
            }
          : null,
      }),
    ),
  ),
);

console.log("--- DISPATCH RESULTS ---");
for (const result of results) {
  console.log(JSON.stringify(result));
}

const { data: buses, error: busesError } = await supabase
  .from("buses")
  .select("*")
  .order("bus_number");

console.log("--- FINAL BUSES STATE ---");
console.log(
  JSON.stringify(
    {
      busesError: busesError
        ? {
            message: busesError.message,
            code: busesError.code,
            details: busesError.details,
            hint: busesError.hint,
          }
        : null,
      buses,
    },
    null,
    2,
  ),
);
