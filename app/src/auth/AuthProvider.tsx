import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { limparCacheDeLeitura } from '../ui/kit';
import type { Profile, Barber, AdminPermission } from '../lib/types';

/* Colunas pedidas de forma explícita. Com `select('*')` o PostgREST devolve
   todas as colunas da tabela, inclusive as que a interface nem declara. */
const COLUNAS_PERFIL = 'id,role,full_name,phone,email,active,permissions,created_at';
const COLUNAS_BARBEIRO = 'id,profile_id,display_name,specialty,bio,photo_url,active,order_index';

interface Ctx {
  session: Session | null;
  profile: Profile | null;
  barber: Barber | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  can: (p: AdminPermission) => boolean;
  isOwner: boolean;
  isStaff: boolean;
  isBarber: boolean;
}

const AuthCtx = createContext<Ctx | null>(null);
export const useAuth = () => {
  const c = useContext(AuthCtx);
  if (!c) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return c;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [barber, setBarber] = useState<Barber | null>(null);
  const [loading, setLoading] = useState(true);

  /* De quem é o perfil que já está carregado. Serve para não repetir as
     consultas quando o supabase-js reemite um evento para o mesmo usuário:
     INITIAL_SESSION logo depois do getSession, e TOKEN_REFRESHED a cada
     renovação de token (a cada ~50 min), que antes refazia tudo e
     re-renderizava o aplicativo inteiro sem necessidade. */
  const perfilDe = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;

    /* Carrega perfil e cadastro profissional em paralelo. Antes era em série:
       getSession -> profiles -> barbers, três idas e voltas antes da primeira
       tela montar. O cadastro de barbeiro só é aplicado quando o papel é
       `barber`, igual a antes — um proprietário que também tenha ficha de
       profissional continua vendo o próprio nome, não o nome de exibição. */
    async function hidratar(s: Session | null) {
      if (!s) { perfilDe.current = null; setProfile(null); setBarber(null); return; }
      perfilDe.current = s.user.id;

      const [resPerfil, resBarbeiro] = await Promise.all([
        supabase.from('profiles').select(COLUNAS_PERFIL).eq('id', s.user.id).maybeSingle(),
        supabase.from('barbers').select(COLUNAS_BARBEIRO).eq('profile_id', s.user.id).maybeSingle(),
      ]);
      if (!alive) return;

      const p = (resPerfil.data as Profile | null) ?? null;
      setProfile(p);
      setBarber(p?.role === 'barber' ? ((resBarbeiro.data as Barber | null) ?? null) : null);
    }

    /* Rede de segurança: se a sessão não responder, a tela não fica presa no
       spinner para sempre. Sem sessão o usuário cai no login e tenta de novo,
       que é muito melhor do que uma tela de carregamento infinita. */
    const limite = window.setTimeout(() => {
      if (alive) {
        console.warn('[Diamond] a sessão demorou demais; indo para o login.');
        setLoading(false);
      }
    }, 8000);

    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      setSession(data.session);
      await hidratar(data.session);
      if (alive) { window.clearTimeout(limite); setLoading(false); }
    }).catch(() => {
      if (alive) { window.clearTimeout(limite); setLoading(false); }
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, s) => {
      if (!alive) return;
      setSession(s);
      // mesmo usuário de antes: só o token mudou, o perfil continua valendo
      if (s && s.user.id === perfilDe.current) return;
      await hidratar(s);
      if (alive) { window.clearTimeout(limite); setLoading(false); }
    });

    return () => { alive = false; window.clearTimeout(limite); sub.subscription.unsubscribe(); };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      throw new Error(
        error.message === 'Invalid login credentials'
          ? 'E-mail ou senha incorretos.'
          : error.message
      );
    }
  }, []);

  const signOut = useCallback(async () => {
    /* O cache de leitura é compartilhado entre as telas e vive no módulo.
       Sem limpar aqui, quem entrasse depois na mesma aba veria por um
       instante os dados do usuário anterior. */
    limparCacheDeLeitura();
    await supabase.auth.signOut();
  }, []);

  /* O valor do contexto era um objeto literal novo em cada render, e `can`
     era uma função nova junto. Todo consumidor de useAuth — o Shell, o
     componente de rotas, os guardas de permissão e as telas — era obrigado
     a re-renderizar mesmo quando papel e permissões não tinham mudado. */
  const valor = useMemo<Ctx>(() => {
    const role = profile?.role ?? null;
    const isOwner = role === 'owner';
    return {
      session,
      profile,
      barber,
      loading,
      signIn,
      signOut,
      isOwner,
      isStaff: role === 'owner' || role === 'admin',
      isBarber: role === 'barber',
      can: (p: AdminPermission) =>
        isOwner ? true : role === 'admin' ? Boolean(profile?.permissions?.[p]) : false,
    };
  }, [session, profile, barber, loading, signIn, signOut]);

  return <AuthCtx.Provider value={valor}>{children}</AuthCtx.Provider>;
}
