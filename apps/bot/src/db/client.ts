import { createClient } from "@supabase/supabase-js";
import type { Database } from "@alfred/db";
import { config } from "../config";

// service_role ignora a RLS: só src/db/ pode importar este cliente.
export const supabase = createClient<Database>(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
