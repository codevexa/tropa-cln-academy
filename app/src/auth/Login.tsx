import { useState } from 'react';
import { useAuth } from './AuthProvider';
import { useSubmit, Field, ErrorBox, Banner } from '../ui/kit';
import { supabaseConfigured } from '../lib/supabase';

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { busy, error, run } = useSubmit();

  return (
    <div className="login">
      <div className="login-card">
        <img src="/logo-badge.png" alt="Diamond Barbearia" width={92} height={92} />
        <h1>Diamond Barbearia</h1>
        <p>Sistema de gestão</p>

        {!supabaseConfigured && (
          <div className="mb16">
            <Banner tone="warn">
              <b>Conexão não configurada.</b> Copie <code>app/.env.example</code> para{' '}
              <code>app/.env</code> e preencha a URL e a chave do projeto Supabase.
            </Banner>
          </div>
        )}

        <form className="login-form" onSubmit={(e) => run(e, () => signIn(email, password))}>
          <Field label="E-mail">
            <input className="inp" type="email" autoComplete="username" required
                   value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@diamond.com" />
          </Field>
          <Field label="Senha">
            <input className="inp" type="password" autoComplete="current-password" required
                   value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </Field>
          {error && <ErrorBox msg={error} />}
          <button className="btn pri block mt8" disabled={busy || !supabaseConfigured}>
            {busy ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <p className="hint mt24">
          O acesso é criado pelo proprietário no menu Profissionais.
        </p>
      </div>
    </div>
  );
}
