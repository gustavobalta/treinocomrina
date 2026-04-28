import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://uyervdalbirxvedakhfd.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5ZXJ2ZGFsYmlyeHZlZGFraGZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczODgyNjQsImV4cCI6MjA5Mjk2NDI2NH0.wr_TOkPqXZDV2SIfuOFh_bQ6tEU_aAebwt5OlW3tHCg";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
