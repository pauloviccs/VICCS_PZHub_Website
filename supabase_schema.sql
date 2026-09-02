-- =========================================================================
-- PZHub Ecosystem - Database Schema (PostgreSQL + Supabase)
-- =========================================================================

-- 1. EXTENSÕES & ENUMS
CREATE TYPE user_role AS ENUM ('user', 'creator', 'moderator', 'admin');
CREATE TYPE report_status AS ENUM ('open', 'investigating', 'resolved', 'dismissed');

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

-- 4. TABELA: MODPACKS & MODS PUBLICADOS
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

-- 5. TABELA: LIKES EM MODPACKS
CREATE TABLE IF NOT EXISTS public.modpack_likes (
  modpack_id TEXT REFERENCES public.modpacks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (modpack_id, user_id)
);

-- 6. TABELA: CHANGELOGS DE MODPACK (HISTÓRICO DE VERSÕES)
CREATE TABLE IF NOT EXISTS public.modpack_changelogs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  modpack_id TEXT REFERENCES public.modpacks(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  title TEXT NOT NULL,
  notes TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. TABELA: COMENTÁRIOS DE MODPACKS / MODS
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  target_id TEXT NOT NULL, -- ID do modpack
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
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL, -- Dono do mural
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,  -- Quem escreveu
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
  target_type TEXT NOT NULL, -- 'modpack', 'comment', 'profile'
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
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modpacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modpack_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modpack_changelogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_scraps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Profiles: Leitura pública, update apenas pelo próprio usuário ou admin
CREATE POLICY "Profiles são públicos" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Usuário pode atualizar próprio perfil" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Follows: Qualquer um pode ver seguidores; autenticados podem seguir/desseguir
CREATE POLICY "Follows são públicos" ON public.follows FOR SELECT USING (true);
CREATE POLICY "Usuário pode seguir/desseguir" ON public.follows FOR ALL USING (auth.uid() = follower_id);

-- Modpacks: Leitura pública, inserção/update pelo autor ou admin
CREATE POLICY "Modpacks públicos visíveis" ON public.modpacks FOR SELECT USING (is_public = true OR auth.uid() = author_id);
CREATE POLICY "Criadores publicam modpacks" ON public.modpacks FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Criadores atualizam seus modpacks" ON public.modpacks FOR UPDATE USING (auth.uid() = author_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'moderator')));
CREATE POLICY "Criadores deletam seus modpacks" ON public.modpacks FOR DELETE USING (auth.uid() = author_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'moderator')));

-- Profile Scraps (REGRA DE OURO):
-- Leitura pública, escrita autenticada, DELETE PERMITIDO APENAS PELO DONO DO MURAL OU ADMIN/MOD
CREATE POLICY "Recados são públicos" ON public.profile_scraps FOR SELECT USING (true);
CREATE POLICY "Usuários autenticados podem postar recados" ON public.profile_scraps FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Apenas dono do perfil ou staff pode deletar recados" ON public.profile_scraps FOR DELETE USING (
  auth.uid() = profile_id OR 
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'moderator'))
);

-- Changelogs: Leitura pública, inserção/update pelo criador do modpack ou staff
CREATE POLICY "Changelogs são públicos" ON public.modpack_changelogs FOR SELECT USING (true);
CREATE POLICY "Criador ou staff gerenciam changelogs" ON public.modpack_changelogs FOR ALL USING (
  auth.uid() IS NOT NULL
);

-- Comments:
CREATE POLICY "Comentários são públicos" ON public.comments FOR SELECT USING (true);
CREATE POLICY "Usuários postam comentários" ON public.comments FOR INSERT WITH CHECK (auth.uid() = author_id);

-- Reports: Autenticado cria report; Staff visualiza e resolve
CREATE POLICY "Usuários podem reportar" ON public.reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Apenas staff visualiza e gerencia denúncias" ON public.reports FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'moderator'))
);
