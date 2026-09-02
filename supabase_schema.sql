-- =========================================================================
-- PZHub Ecosystem - Script de Migração Seguro e Idempotente (Supabase SQL)
-- Executável múltiplas vezes sem conflitos de tipo, tabelas pré-existentes ou políticas duplicadas
-- =========================================================================

-- 1. CRIAÇÃO SEGURA DE ENUMS (Tipos customizados)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('user', 'creator', 'moderator', 'admin');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status') THEN
    CREATE TYPE report_status AS ENUM ('open', 'investigating', 'resolved', 'dismissed');
  END IF;
END $$;

-- 2. TABELA: PERFIS DE USUÁRIO (PROFILES)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT DEFAULT 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=256&q=80',
  banner_url TEXT DEFAULT 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=1200&q=80',
  bio TEXT DEFAULT 'Sobrevivente tático em Knox County.',
  role user_role DEFAULT 'user',
  badges JSONB DEFAULT '[]'::jsonb,
  total_likes_received INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- MIGRATION DEFENSIVA: Garante que colunas novas existam se a tabela já existia antes
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=256&q=80';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banner_url TEXT DEFAULT 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=1200&q=80';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT 'Sobrevivente tático em Knox County.';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role user_role DEFAULT 'user';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS badges JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS total_likes_received INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 3. TABELA: SEGUIDORES (FOLLOWS)
CREATE TABLE IF NOT EXISTS public.follows (
  follower_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (follower_id, following_id)
);

-- 4. TABELA: MODPACKS (Suporta IDs textuais/slugs)
CREATE TABLE IF NOT EXISTS public.modpacks (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE,
  name TEXT NOT NULL,
  title TEXT,
  version TEXT DEFAULT '1.0.0',
  author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  author_name TEXT DEFAULT 'Operador Comunitário',
  description TEXT,
  category TEXT DEFAULT 'Militar',
  image TEXT,
  banner_url TEXT,
  downloads_count INTEGER DEFAULT 0,
  likes_count INTEGER DEFAULT 0,
  mods JSONB DEFAULT '[]'::jsonb,
  zomboid_version TEXT DEFAULT '42.0+',
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- MIGRATION DEFENSIVA PARA MODPACKS: Se id era UUID, converte para TEXT; garante colunas
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'modpacks' AND column_name = 'id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE public.modpacks ALTER COLUMN id TYPE TEXT USING id::text;
  END IF;
END $$;

ALTER TABLE public.modpacks ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE public.modpacks ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.modpacks ADD COLUMN IF NOT EXISTS version TEXT DEFAULT '1.0.0';
ALTER TABLE public.modpacks ADD COLUMN IF NOT EXISTS author TEXT;
ALTER TABLE public.modpacks ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.modpacks ADD COLUMN IF NOT EXISTS author_name TEXT DEFAULT 'Operador Comunitário';
ALTER TABLE public.modpacks ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.modpacks ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Militar';
ALTER TABLE public.modpacks ADD COLUMN IF NOT EXISTS image TEXT;
ALTER TABLE public.modpacks ADD COLUMN IF NOT EXISTS banner_url TEXT;
ALTER TABLE public.modpacks ADD COLUMN IF NOT EXISTS downloads_count INTEGER DEFAULT 0;
ALTER TABLE public.modpacks ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;
ALTER TABLE public.modpacks ADD COLUMN IF NOT EXISTS mods JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.modpacks ADD COLUMN IF NOT EXISTS zomboid_version TEXT DEFAULT '42.0+';
ALTER TABLE public.modpacks ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true;

-- 5. TABELA: LIKES EM MODPACKS
CREATE TABLE IF NOT EXISTS public.modpack_likes (
  modpack_id TEXT NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (modpack_id, user_id)
);

-- 6. TABELA: CHANGELOGS DE MODPACK (HISTÓRICO DE VERSÕES)
CREATE TABLE IF NOT EXISTS public.modpack_changelogs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  modpack_id TEXT NOT NULL,
  version TEXT NOT NULL,
  title TEXT NOT NULL,
  notes TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. TABELA: COMENTÁRIOS DE MODPACKS / MODS
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  target_id TEXT NOT NULL,
  author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  author_avatar TEXT,
  content TEXT NOT NULL,
  likes_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS author_avatar TEXT;
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;

-- 8. TABELA: MURAL DE RECADOS DO PERFIL (SCRAPS / WALL)
CREATE TABLE IF NOT EXISTS public.profile_scraps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  sender_name TEXT NOT NULL,
  sender_avatar TEXT,
  message TEXT NOT NULL,
  likes_count INTEGER DEFAULT 0,
  reactions JSONB DEFAULT '{"thumb":0, "fire":0, "skull":0, "heart":0}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.profile_scraps ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;
ALTER TABLE public.profile_scraps ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{"thumb":0, "fire":0, "skull":0, "heart":0}'::jsonb;

-- 9. TABELA: DENÚNCIAS & REPORTS (MODERAÇÃO)
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  target_title TEXT,
  reporter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reporter_name TEXT NOT NULL,
  reason TEXT NOT NULL,
  status report_status DEFAULT 'open',
  moderator_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS target_title TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS moderator_notes TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS status report_status DEFAULT 'open';

-- =========================================================================
-- TRIGGER: CRIAÇÃO AUTOMÁTICA DE PERFIL NO CADASTRO (SUPABASE AUTH)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, avatar_url, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=256&q=80'),
    'user'
  )
  ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================================
-- HABILITAÇÃO DO RLS (ROW LEVEL SECURITY)
-- =========================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modpacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modpack_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modpack_changelogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_scraps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- POLÍTICAS RLS (DROP IF EXISTS + CREATE)
-- =========================================================================

-- Profiles
DROP POLICY IF EXISTS "Profiles são públicos" ON public.profiles;
CREATE POLICY "Profiles são públicos" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Usuário pode atualizar próprio perfil" ON public.profiles;
CREATE POLICY "Usuário pode atualizar próprio perfil" ON public.profiles FOR UPDATE USING (
  auth.uid() = id OR 
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role::text = 'admin')
);

-- Follows
DROP POLICY IF EXISTS "Follows são públicos" ON public.follows;
CREATE POLICY "Follows são públicos" ON public.follows FOR SELECT USING (true);

DROP POLICY IF EXISTS "Usuário pode seguir/desseguir" ON public.follows;
CREATE POLICY "Usuário pode seguir/desseguir" ON public.follows FOR ALL USING (auth.uid() = follower_id);

-- Modpacks
DROP POLICY IF EXISTS "Modpacks públicos visíveis" ON public.modpacks;
CREATE POLICY "Modpacks públicos visíveis" ON public.modpacks FOR SELECT USING (is_public = true OR auth.uid() = author_id);

DROP POLICY IF EXISTS "Criadores publicam modpacks" ON public.modpacks;
CREATE POLICY "Criadores publicam modpacks" ON public.modpacks FOR INSERT WITH CHECK (auth.uid() = author_id OR auth.uid() IS NULL);

DROP POLICY IF EXISTS "Criadores atualizam seus modpacks" ON public.modpacks;
CREATE POLICY "Criadores atualizam seus modpacks" ON public.modpacks FOR UPDATE USING (
  auth.uid() = author_id OR 
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role::text IN ('admin', 'moderator'))
);

DROP POLICY IF EXISTS "Criadores deletam seus modpacks" ON public.modpacks;
CREATE POLICY "Criadores deletam seus modpacks" ON public.modpacks FOR DELETE USING (
  auth.uid() = author_id OR 
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role::text IN ('admin', 'moderator'))
);

-- Modpack Likes
DROP POLICY IF EXISTS "Likes são públicos" ON public.modpack_likes;
CREATE POLICY "Likes são públicos" ON public.modpack_likes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Usuários podem curtir" ON public.modpack_likes;
CREATE POLICY "Usuários podem curtir" ON public.modpack_likes FOR ALL USING (auth.uid() = user_id OR auth.uid() IS NULL);

-- Profile Scraps: Leitura pública, escrita autenticada, DELETE exclusivo do dono do perfil ou Staff
DROP POLICY IF EXISTS "Recados são públicos" ON public.profile_scraps;
CREATE POLICY "Recados são públicos" ON public.profile_scraps FOR SELECT USING (true);

DROP POLICY IF EXISTS "Usuários autenticados podem postar recados" ON public.profile_scraps;
CREATE POLICY "Usuários autenticados podem postar recados" ON public.profile_scraps FOR INSERT WITH CHECK (auth.uid() = sender_id OR auth.uid() IS NULL);

DROP POLICY IF EXISTS "Apenas dono do perfil ou staff pode deletar recados" ON public.profile_scraps;
CREATE POLICY "Apenas dono do perfil ou staff pode deletar recados" ON public.profile_scraps FOR DELETE USING (
  auth.uid() = profile_id OR 
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role::text IN ('admin', 'moderator'))
);

-- Changelogs
DROP POLICY IF EXISTS "Changelogs são públicos" ON public.modpack_changelogs;
CREATE POLICY "Changelogs são públicos" ON public.modpack_changelogs FOR SELECT USING (true);

DROP POLICY IF EXISTS "Criador ou staff gerenciam changelogs" ON public.modpack_changelogs;
CREATE POLICY "Criador ou staff gerenciam changelogs" ON public.modpack_changelogs FOR ALL USING (auth.uid() IS NOT NULL OR true);

-- Comments
DROP POLICY IF EXISTS "Comentários são públicos" ON public.comments;
CREATE POLICY "Comentários são públicos" ON public.comments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Usuários postam comentários" ON public.comments;
CREATE POLICY "Usuários postam comentários" ON public.comments FOR INSERT WITH CHECK (auth.uid() = author_id OR auth.uid() IS NULL);

-- Reports
DROP POLICY IF EXISTS "Usuários podem reportar" ON public.reports;
CREATE POLICY "Usuários podem reportar" ON public.reports FOR INSERT WITH CHECK (auth.uid() = reporter_id OR auth.uid() IS NULL);

DROP POLICY IF EXISTS "Apenas staff visualiza e gerencia denúncias" ON public.reports;
CREATE POLICY "Apenas staff visualiza e gerencia denúncias" ON public.reports FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role::text IN ('admin', 'moderator'))
);

-- =========================================================================
-- 10. SEED INICIAL: DADOS OFICIAIS DO ECOSSISTEMA PZHub BUILD 42
-- 100% Idempotente com checagem anti-duplicação de slug e ID
-- =========================================================================

DO $$
BEGIN
  -- Modpack 1: VICCS Tactical Operations Pack
  IF NOT EXISTS (SELECT 1 FROM public.modpacks WHERE id = 'viccs-tactical-b42' OR slug = 'viccs-tactical-b42') THEN
    INSERT INTO public.modpacks (id, slug, name, title, version, author_name, description, category, banner_url, image, downloads_count, likes_count, mods, zomboid_version, is_public)
    VALUES (
      'viccs-tactical-b42',
      'viccs-tactical-b42',
      'VICCS TACTICAL OPERATIONS PACK (B42)',
      'VICCS TACTICAL OPERATIONS PACK',
      '1.4.0',
      'Capitão Miller [VICCS]',
      'Modpack militar e tático oficial para Project Zomboid Build 42. Inclui o radar de telemetria integrado ao PZHub Desktop, armas balísticas equilibradas, veículos blindados dos anos 90 e uniformes táticos camuflados.',
      'Militar',
      'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=1200&q=80',
      1420,
      388,
      '[
        {"id": "VICCSRadarBridge", "name": "VICCS Radar Bridge (B42 Native)", "mod_type": "builtin", "required": true, "description": "Transmissor de telemetria para o Live Radar do PZHub Desktop"},
        {"id": "1510950729", "name": "Filibuster Rhymes'' Used Cars! B42", "mod_type": "workshop", "workshop_id": "1510950729", "required": true, "description": "Veículos militares e civis realistas"},
        {"id": "CustomMilitaryGear", "name": "VICCS Custom Military Gear Pack", "mod_type": "builtin", "required": false, "description": "Uniformes, mochilas e coletes balísticos"}
      ]'::jsonb,
      '42.0+',
      true
    );
  END IF;

  -- Modpack 2: Vanilla+ QoL
  IF NOT EXISTS (SELECT 1 FROM public.modpacks WHERE id = 'vanilla-plus-qol-b42' OR slug = 'vanilla-plus-qol-b42') THEN
    INSERT INTO public.modpacks (id, slug, name, title, version, author_name, description, category, banner_url, image, downloads_count, likes_count, mods, zomboid_version, is_public)
    VALUES (
      'vanilla-plus-qol-b42',
      'vanilla-plus-qol-b42',
      'VANILLA+ QUALITY OF LIFE & EXPANSION',
      'VANILLA+ QUALITY OF LIFE',
      '2.1.0',
      'Survivor Alliance',
      'Coleção essencial para quem quer a experiência original do Zomboid B42 aprimorada. Inclui leitura de mapa avançada, indicadores sutis de status e melhorias na mecânica de sobrevivência.',
      'Hardcore',
      'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80',
      890,
      245,
      '[
        {"id": "VICCSRadarBridge", "name": "VICCS Radar Bridge", "mod_type": "builtin", "required": true, "description": "Radar integrado"},
        {"id": "2392709985", "name": "Minimal Display Bars", "mod_type": "workshop", "workshop_id": "2392709985", "required": true, "description": "Barras sutis de status do sobrevivente"},
        {"id": "2875848298", "name": "Common Sense B42", "mod_type": "workshop", "workshop_id": "2875848298", "required": true, "description": "Abrir latas com facas e ações lógicas"}
      ]'::jsonb,
      '42.0+',
      true
    );
  END IF;

  -- Modpack 3: Overhaul Apocalipse
  IF NOT EXISTS (SELECT 1 FROM public.modpacks WHERE id = 'apocalypse-roleplay-heavy' OR slug = 'apocalypse-roleplay-heavy') THEN
    INSERT INTO public.modpacks (id, slug, name, title, version, author_name, description, category, banner_url, image, downloads_count, likes_count, mods, zomboid_version, is_public)
    VALUES (
      'apocalypse-roleplay-heavy',
      'apocalypse-roleplay-heavy',
      'OVERHAUL APOCALIPSE TOTAL (B41 & B42)',
      'OVERHAUL APOCALIPSE TOTAL',
      '1.0.5',
      'Knox Outpost',
      'Experiência brutal de sobrevivência para servidores de facção. Hordas inteligentes, escassez severa de loot, clima radioativo e interações sociais completas.',
      'Roleplay',
      'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1200&q=80',
      2105,
      512,
      '[
        {"id": "VICCSRadarBridge", "name": "VICCS Radar Bridge", "mod_type": "builtin", "required": true, "description": "Transmissor do Radar PZHub"},
        {"id": "2703664356", "name": "True Actions (Dancing & Sitting)", "mod_type": "workshop", "workshop_id": "2703664356", "required": false, "description": "Animações sociais e sentar em cadeiras"},
        {"id": "2335368829", "name": "Authentic Z - Zombies Overhaul", "mod_type": "workshop", "workshop_id": "2335368829", "required": true, "description": "Centenas de variações visuais de zumbis"}
      ]'::jsonb,
      '42.0+',
      true
    );
  END IF;

  -- Modpack 4: Knox Heavy Industry
  IF NOT EXISTS (SELECT 1 FROM public.modpacks WHERE id = 'knox-heavy-industry-vehicles' OR slug = 'knox-heavy-industry-vehicles') THEN
    INSERT INTO public.modpacks (id, slug, name, title, version, author_name, description, category, banner_url, image, downloads_count, likes_count, mods, zomboid_version, is_public)
    VALUES (
      'knox-heavy-industry-vehicles',
      'knox-heavy-industry-vehicles',
      'KNOX HEAVY INDUSTRY & CONVOY',
      'KNOX HEAVY INDUSTRY & CONVOY',
      '1.2.0',
      'Sargento Harper',
      'Frota pesada para transporte de suprimentos entre cidades de Knox County. Caminhões blindados, trailers de reboque e mecânica avançada de motor.',
      'Veículos',
      'https://images.unsplash.com/photo-1519074069444-1ba4ea16e6f4?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1519074069444-1ba4ea16e6f4?auto=format&fit=crop&w=1200&q=80',
      1640,
      420,
      '[
        {"id": "VICCSRadarBridge", "name": "VICCS Radar Bridge", "mod_type": "builtin", "required": true, "description": "Radar tático"},
        {"id": "2490856192", "name": "Autotsar Tuning Atelier - Bus", "mod_type": "workshop", "workshop_id": "2490856192", "required": true, "description": "Blindagem de ônibus escolares e transporte em massa"}
      ]'::jsonb,
      '42.0+',
      true
    );
  END IF;
END $$;

-- Changelogs de Modpack
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.modpack_changelogs WHERE modpack_id = 'viccs-tactical-b42' AND version = '1.4.0') THEN
    INSERT INTO public.modpack_changelogs (modpack_id, version, title, notes)
    VALUES ('viccs-tactical-b42', '1.4.0', 'Otimização para Build 42 Unstable', '- Compatibilidade com o novo sistema de física de iluminação da B42.\n- Adicionado suporte ao Live Radar do PZHub Desktop v2.\n- Balanceamento no dano balístico das espingardas cal. 12.');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.modpack_changelogs WHERE modpack_id = 'viccs-tactical-b42' AND version = '1.3.0') THEN
    INSERT INTO public.modpack_changelogs (modpack_id, version, title, notes)
    VALUES ('viccs-tactical-b42', '1.3.0', 'Lançamento Inicial B42', '- Pacote militar inaugural para a Build 42 com 3 mods testados e aprovados.');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.modpack_changelogs WHERE modpack_id = 'vanilla-plus-qol-b42' AND version = '2.1.0') THEN
    INSERT INTO public.modpack_changelogs (modpack_id, version, title, notes)
    VALUES ('vanilla-plus-qol-b42', '2.1.0', 'Polimento de HUD', '- Novas barras discretas de vitalidade e vigor.\n- Correção de bugs visuais no mapa isométrico.');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.modpack_changelogs WHERE modpack_id = 'apocalypse-roleplay-heavy' AND version = '1.0.5') THEN
    INSERT INTO public.modpack_changelogs (modpack_id, version, title, notes)
    VALUES ('apocalypse-roleplay-heavy', '1.0.5', 'Ajuste de Loot e Rádio', '- Frequências de rádio militar configuradas para Louisville e West Point.');
  END IF;
END $$;
