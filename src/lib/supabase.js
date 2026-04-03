import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://tokgukksskcmmfnmvhxo.supabase.co'
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRva2d1a2tzc2tjbW1mbm12aHhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNjIyNzUsImV4cCI6MjA5MDczODI3NX0.m1EheqwP03wRgX0CEcaw2W1_RLBkK8apvYYNcgrKxCE'

export const supabase = createClient(supabaseUrl, supabaseKey)
