// Legacy shim — prefer importing from src/lib/supabase/{server,browser,admin}.ts.
// Still re-exported here so scripts and older modules keep compiling.
export { getSupabaseAdmin as getSupabase } from "./supabase/admin";
