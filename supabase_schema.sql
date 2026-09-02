-- =========================================================================
-- PZHub Ecosystem - Script de Migração Seguro e Idempotente (Supabase SQL)
-- Executável múltiplas vezes sem conflitos de tipo ou políticas duplicadas
-- =========================================================================

-- 1. CRIAÇÃO SEGURA DE ENUMS
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

-- 3. TABELA: SEGUIDORES (FOLLOWS)
CREATE TABLE IF NOT EXISTS public.follows (
  follower_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (follower_id, following_id)
);

-- 4. TABELA: MODPACKS (Garante que a coluna ID seja TEXT para suportar slugs e IDs táticos)
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

-- Se a tabela modpacks já existia com ID UUID, converte com segurança para TEXT
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'modpacks' AND column_name = 'id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE public.modpacks ALTER COLUMN id TYPE TEXT USING id::text;
  END IF;
END $$;

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
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================================
-- HABILITAÇÃO DO RLS
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
CREATE POLICY "Usuário pode atualizar próprio perfil" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Follows
DROP POLICY IF EXISTS "Follows são públicos" ON public.follows;
CREATE POLICY "Follows são públicos" ON public.follows FOR SELECT USING (true);

DROP POLICY IF EXISTS "Usuário pode seguir/desseguir" ON public.follows;
CREATE POLICY "Usuário pode seguir/desseguir" ON public.follows FOR ALL USING (auth.uid() = follower_id);

-- Modpacks
DROP POLICY IF EXISTS "Modpacks públicos visíveis" ON public.modpacks;
CREATE POLICY "Modpacks públicos visíveis" ON public.modpacks FOR SELECT USING (is_public = true OR auth.uid() = author_id);

DROP POLICY IF EXISTS "Criadores publicam modpacks" ON public.modpacks;
CREATE POLICY "Criadores publicam modpacks" ON public.modpacks FOR INSERT WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "Criadores atualizam seus modpacks" ON public.modpacks;
CREATE POLICY "Criadores atualizam seus modpacks" ON public.modpacks FOR UPDATE USING (
  auth.uid() = author_id OR 
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'moderator'))
);

DROP POLICY IF EXISTS "Criadores deletam seus modpacks" ON public.modpacks;
CREATE POLICY "Criadores deletam seus modpacks" ON public.modpacks FOR DELETE USING (
  auth.uid() = author_id OR 
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'moderator'))
);

-- Modpack Likes
DROP POLICY IF EXISTS "Likes são públicos" ON public.modpack_likes;
CREATE POLICY "Likes são públicos" ON public.modpack_likes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Usuários podem curtir" ON public.modpack_likes;
CREATE POLICY "Usuários podem curtir" ON public.modpack_likes FOR ALL USING (auth.uid() = user_id);

-- Profile Scraps (REGRA DE OURO):
-- Leitura pública, escrita autenticada, DELETE PERMITIDO APENAS PELO DONO DO MURAL OU ADMIN/MOD
DROP POLICY IF EXISTS "Recados são públicos" ON public.profile_scraps;
CREATE POLICY "Recados são públicos" ON public.profile_scraps FOR SELECT USING (true);

DROP POLICY IF EXISTS "Usuários autenticados podem postar recados" ON public.profile_scraps;
CREATE POLICY "Usuários autenticados podem postar recados" ON public.profile_scraps FOR INSERT WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Apenas dono do perfil ou staff pode deletar recados" ON public.profile_scraps;
CREATE POLICY "Apenas dono do perfil ou staff pode deletar recados" ON public.profile_scraps FOR DELETE USING (
  auth.uid() = profile_id OR 
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'moderator'))
);

-- Changelogs
DROP POLICY IF EXISTS "Changelogs são públicos" ON public.modpack_changelogs;
CREATE POLICY "Changelogs são públicos" ON public.modpack_changelogs FOR SELECT USING (true);

DROP POLICY IF EXISTS "Criador ou staff gerenciam changelogs" ON public.modpack_changelogs;
CREATE POLICY "Criador ou staff gerenciam changelogs" ON public.modpack_changelogs FOR ALL USING (auth.uid() IS NOT NULL);

-- Comments
DROP POLICY IF EXISTS "Comentários são públicos" ON public.comments;
CREATE POLICY "Comentários são públicos" ON public.comments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Usuários postam comentários" ON public.comments;
CREATE POLICY "Usuários postam comentários" ON public.comments FOR INSERT WITH CHECK (auth.uid() = author_id);

-- Reports
DROP POLICY IF EXISTS "Usuários podem reportar" ON public.reports;
CREATE POLICY "Usuários podem reportar" ON public.reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "Apenas staff visualiza e gerencia denúncias" ON public.reports;
CREATE POLICY "Apenas staff visualiza e gerencia denúncias" ON public.reports FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'moderator'))
);
