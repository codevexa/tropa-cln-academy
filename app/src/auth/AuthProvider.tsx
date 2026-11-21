import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile, Barber, AdminPermission } from '../lib/types';

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

  // Carrega perfil e, se for barbeiro, o cadastro profissional dele.
  async function hydrate(s: Session | null) {
    if (!s) { setProfile(null); setBarber(null); return; }
    const { data: p } = await supabase
      .from('profiles').select('*').eq('id', s.user.id).maybeSingle();
    setProfile((p as Profile) ?? null);

    if (p && (p as Profile).role === 'barber') {
      const { data: b } = await supabase
        .from('barbers').select('*').eq('profile_id', s.user.id).maybeSingle();
      setBarber((b as Barber) ?? null);
    } else {
      setBarber(null);
    }
  }

  useEffect(() => {
    let alive = true;

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
      await hydrate(data.session);
      if (alive) { window.clearTimeout(limite); setLoading(false); }
    }).catch(() => {
      if (alive) { window.clearTimeout(limite); setLoading(false); }
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, s) => {
      if (!alive) return;
      setSession(s);
      await hydrate(s);
      setLoading(false);
    });
    return () => { alive = false; window.clearTimeout(limite); sub.subscription.unsubscribe(); };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      throw new Error(
        error.message === 'Invalid login credentials'
          ? 'E-mail ou senha incorretos.'
          : error.message
      );
    }
  };

  const signOut = async () => { await supabase.auth.signOut(); };

  const role = profile?.role ?? null;
  const isOwner = role === 'owner';
  const isStaff = role === 'owner' || role === 'admin';
  const isBarber = role === 'barber';
  const can = (p: AdminPermission) =>
    isOwner ? true : role === 'admin' ? Boolean(profile?.permissions?.[p]) : false;

  return (
    <AuthCtx.Provider value={{ session, profile, barber, loading, signIn, signOut, can, isOwner, isStaff, isBarber }}>
      {children}
    </AuthCtx.Provider>
  );
}
