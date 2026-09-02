/**
 * PZHub - Supabase Client & Data Layer
 * Conexão direta de produção com a instância Supabase oficial.
 */

import { createClient } from '@supabase/supabase-js';

// 1. Configuração de Backend / Ambiente
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://legqoupwzpdzqqhwuwwv.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxlZ3FvdXB3enBkenFxaHd1d3d2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyOTQ5MTUsImV4cCI6MjEwMzg3MDkxNX0.B1WzociWqnXIE9AM3NA6cY7c7UM-2kLztjgeIQOYJQs';

export const isConfigured = true;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
