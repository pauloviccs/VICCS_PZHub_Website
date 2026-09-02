/**
 * PZHub - Supabase Client & Data Layer
 * Conexão transparente com Supabase via variáveis de ambiente (.env / Vercel) ou configurações salvas localmente.
 */

import { createClient } from '@supabase/supabase-js';

// 1. Obtém chaves do ambiente Vite ou do localStorage
const envUrl = import.meta.env.VITE_SUPABASE_URL;
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const localUrl = localStorage.getItem('PZHUB_SUPABASE_URL');
const localKey = localStorage.getItem('PZHUB_SUPABASE_ANON_KEY');

const SUPABASE_URL = localUrl || envUrl || 'https://demo-pzhub.supabase.co';
const SUPABASE_ANON_KEY = localKey || envKey || 'demo-anon-key';

export const isConfigured = Boolean(
  (envUrl && envKey && !envUrl.includes('demo-pzhub')) ||
  (localUrl && localKey)
);

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 2. Modpacks Oficiais da Comunidade PZHub (Fallback imediato de alta qualidade)
export const DEFAULT_COMMUNITY_MODPACKS = [
  {
    id: "viccs-tactical-b42",
    slug: "viccs-tactical-b42",
    name: "VICCS TACTICAL OPERATIONS PACK (B42)",
    version: "1.4.0",
    author: "operador_alpha",
    author_name: "Capitão Miller [VICCS]",
    description: "Modpack militar e tático oficial para Project Zomboid Build 42. Inclui o radar de telemetria integrado ao PZHub Desktop, armas balísticas equilibradas, veículos blindados dos anos 90 e uniformes camuflados.",
    banner_url: "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=1200&q=80",
    image: "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=1200&q=80",
    zomboid_version: "42.0+",
    category: "Militar",
    downloads_count: 1420,
    likes_count: 388,
    mods: [
      { id: "VICCSRadarBridge", name: "VICCS Radar Bridge (B42 Native)", mod_type: "builtin", required: true, description: "Transmissor de telemetria para o Live Radar do PZHub Desktop" },
      { id: "1510950729", name: "Filibuster Rhymes' Used Cars! B42", mod_type: "workshop", workshop_id: "1510950729", required: true, description: "Veículos militares e civis realistas" },
      { id: "CustomMilitaryGear", name: "VICCS Custom Military Gear Pack", mod_type: "builtin", required: false, description: "Uniformes, mochilas e coletes balísticos" }
    ],
    comments: [
      { id: "c-1", author_name: "Rick Grimes", content: "Melhor pacote militar que joguei na B42. Super estável com o radar ligado.", likes_count: 14, created_at: new Date(Date.now() - 3600000 * 5).toISOString() }
    ],
    updated_at: new Date(Date.now() - 86400000 * 2).toISOString()
  },
  {
    id: "vanilla-plus-qol-b42",
    slug: "vanilla-plus-qol-b42",
    name: "VANILLA+ QUALITY OF LIFE & EXPANSION",
    version: "2.1.0",
    author: "survivor_alliance",
    author_name: "Survivor Alliance",
    description: "Coleção essencial para quem quer a experiência original do Zomboid B42 aprimorada. Inclui leitura de mapa avançada, indicadores sutis de status e melhorias na mecânica de sobrevivência.",
    banner_url: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80",
    image: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80",
    zomboid_version: "42.0+",
    category: "Hardcore",
    downloads_count: 890,
    likes_count: 245,
    mods: [
      { id: "VICCSRadarBridge", name: "VICCS Radar Bridge", mod_type: "builtin", required: true, description: "Radar integrado" },
      { id: "2392709985", name: "Minimal Display Bars", mod_type: "workshop", workshop_id: "2392709985", required: true, description: "Barras sutis de status do personagem" },
      { id: "2875848298", name: "Common Sense B42", mod_type: "workshop", workshop_id: "2875848298", required: true, description: "Abrir latas com facas e ações lógicas" }
    ],
    comments: [],
    updated_at: new Date(Date.now() - 86400000 * 5).toISOString()
  },
  {
    id: "apocalypse-roleplay-heavy",
    slug: "apocalypse-roleplay-heavy",
    name: "OVERHAUL APOCALIPSE TOTAL (B41 & B42)",
    version: "1.0.5",
    author: "knox_outpost",
    author_name: "Knox County Outpost",
    description: "Experiência brutal de sobrevivência para servidores de facção. Hordas inteligentes, escassez severa de loot, clima radioativo e interações sociais completas.",
    banner_url: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1200&q=80",
    image: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1200&q=80",
    zomboid_version: "42.0+",
    category: "Roleplay",
    downloads_count: 2105,
    likes_count: 512,
    mods: [
      { id: "VICCSRadarBridge", name: "VICCS Radar Bridge", mod_type: "builtin", required: true, description: "Transmissor do Radar PZHub" },
      { id: "2703664356", name: "True Actions (Dancing & Sitting)", mod_type: "workshop", workshop_id: "2703664356", required: false, description: "Animações sociais e sentar em cadeiras" },
      { id: "2335368829", name: "Authentic Z - Zombies Overhaul", mod_type: "workshop", workshop_id: "2335368829", required: true, description: "Centenas de variações visuais de zumbis" }
    ],
    comments: [],
    updated_at: new Date(Date.now() - 86400000 * 1).toISOString()
  },
  {
    id: "knox-heavy-industry-vehicles",
    slug: "knox-heavy-industry-vehicles",
    name: "KNOX HEAVY INDUSTRY & CONVOY",
    version: "1.2.0",
    author: "sargento_harper",
    author_name: "Sargento Harper",
    description: "Frota pesada para transporte de suprimentos entre cidades de Knox County. Caminhões blindados, trailers de reboque e mecânica avançada de motor.",
    banner_url: "https://images.unsplash.com/photo-1519074069444-1ba4ea16e6f4?auto=format&fit=crop&w=1200&q=80",
    image: "https://images.unsplash.com/photo-1519074069444-1ba4ea16e6f4?auto=format&fit=crop&w=1200&q=80",
    zomboid_version: "42.0+",
    category: "Veículos",
    downloads_count: 1640,
    likes_count: 420,
    mods: [
      { id: "VICCSRadarBridge", name: "VICCS Radar Bridge", mod_type: "builtin", required: true, description: "Radar tático" },
      { id: "2490856192", name: "Autotsar Tuning Atelier - Bus", mod_type: "workshop", workshop_id: "2490856192", required: true, description: "Blindagem de ônibus escolares e transporte em massa" }
    ],
    comments: [],
    updated_at: new Date(Date.now() - 86400000 * 3).toISOString()
  }
];

export async function saveSupabaseCustomCredentials(url, key) {
  if (!url || !key) {
    localStorage.removeItem('PZHUB_SUPABASE_URL');
    localStorage.removeItem('PZHUB_SUPABASE_ANON_KEY');
  } else {
    localStorage.setItem('PZHUB_SUPABASE_URL', url.trim());
    localStorage.setItem('PZHUB_SUPABASE_ANON_KEY', key.trim());
  }
  window.location.reload();
}
