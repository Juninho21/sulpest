import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://badyvhzrjbemyqzeqlaw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhZHl2aHpyamJlbXlxemVxbGF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgzOTA0MDAsImV4cCI6MjA2Mzk2NjQwMH0.WgqhI_ospxNDOvk0jUYvQT9gu3oNvorhZvU';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY); 