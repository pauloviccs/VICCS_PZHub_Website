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

-- 10. TABELA: TIMELINE & RADAR SOCIAL (POSTS ESTILO X / TWITTER)
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  author_username TEXT NOT NULL,
  author_avatar TEXT,
  author_role user_role DEFAULT 'user',
  content TEXT NOT NULL,
  media_urls JSONB DEFAULT '[]'::jsonb,
  youtube_id TEXT,
  likes_count INTEGER DEFAULT 0,
  reposts_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  tags JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 11. TABELA: CURTIDAS EM POSTS DA TIMELINE
CREATE TABLE IF NOT EXISTS public.post_likes (
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (post_id, user_id)
);

-- 12. TABELA: COMENTÁRIOS DE POSTS DA TIMELINE
CREATE TABLE IF NOT EXISTS public.post_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  author_username TEXT NOT NULL,
  author_avatar TEXT,
  content TEXT NOT NULL,
  likes_count INTEGER DEFAULT 0,
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
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- POLÍTICAS RLS (DROP IF EXISTS + CREATE)
-- =========================================================================

-- Posts da Timeline
DROP POLICY IF EXISTS "Posts são públicos" ON public.posts;
CREATE POLICY "Posts são públicos" ON public.posts FOR SELECT USING (true);

DROP POLICY IF EXISTS "Usuários autenticados criam posts" ON public.posts;
CREATE POLICY "Usuários autenticados criam posts" ON public.posts FOR INSERT WITH CHECK (auth.uid() = author_id OR auth.uid() IS NULL);

DROP POLICY IF EXISTS "Autores deletam seus posts" ON public.posts;
CREATE POLICY "Autores deletam seus posts" ON public.posts FOR DELETE USING (
  auth.uid() = author_id OR 
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role::text IN ('admin', 'moderator'))
);

-- Likes em Posts
DROP POLICY IF EXISTS "Post likes são públicos" ON public.post_likes;
CREATE POLICY "Post likes são públicos" ON public.post_likes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Usuários curtem posts" ON public.post_likes;
CREATE POLICY "Usuários curtem posts" ON public.post_likes FOR ALL USING (auth.uid() = user_id OR auth.uid() IS NULL);

-- Comentários em Posts
DROP POLICY IF EXISTS "Comentários em posts são públicos" ON public.post_comments;
CREATE POLICY "Comentários em posts são públicos" ON public.post_comments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Usuários comentam em posts" ON public.post_comments;
CREATE POLICY "Usuários comentam em posts" ON public.post_comments FOR INSERT WITH CHECK (auth.uid() = author_id OR auth.uid() IS NULL);

DROP POLICY IF EXISTS "Autores deletam comentários em posts" ON public.post_comments;
CREATE POLICY "Autores deletam comentários em posts" ON public.post_comments FOR DELETE USING (
  auth.uid() = author_id OR 
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role::text IN ('admin', 'moderator'))
);

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

