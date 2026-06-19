import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient';

type AuthGateProps = {
  children: (session: Session) => ReactNode;
};

export default function AuthGate({ children }: AuthGateProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [identifiant, setIdentifiant] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage('');

    const valeurIdentifiant = identifiant.trim();
    const identifiantAutorise = import.meta.env.VITE_AUTH_USERNAME?.trim();
    const emailCompte = import.meta.env.VITE_AUTH_EMAIL?.trim();
    if (!identifiantAutorise || !emailCompte) {
      setMessage("La connexion par identifiant n'est pas configurée.");
      setSubmitting(false);
      return;
    }
    if (valeurIdentifiant.toLowerCase() !== identifiantAutorise.toLowerCase()) {
      setMessage('Connexion impossible. Vérifiez votre identifiant et votre mot de passe.');
      setSubmitting(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: emailCompte,
      password,
    });

    if (error) {
      setMessage('Connexion impossible. Vérifiez votre identifiant et votre mot de passe.');
    }

    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 text-stone-700">
        Chargement...
      </div>
    );
  }

  if (!session) {
    return (
      <main className="app-login-page">
        <section className="app-login-panel">
          <div className="app-login-mark">FB</div>
          <h1>La Ferme de Bernard</h1>
          <p>Accédez à votre espace de gestion agricole.</p>
          <form className="mt-6 space-y-4" onSubmit={handleSignIn}>
            <label className="block text-left text-sm font-medium text-stone-700">
              Identifiant
              <input
                type="text"
                value={identifiant}
                onChange={(event) => setIdentifiant(event.target.value)}
                className="app-login-input"
                autoComplete="username"
                required
              />
            </label>

            <label className="block text-left text-sm font-medium text-stone-700">
              Mot de passe
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="app-login-input"
                autoComplete="current-password"
                required
              />
            </label>

            {message && (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{message}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="app-login-submit"
            >
              {submitting ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>

        </section>
      </main>
    );
  }

  return <>{children(session)}</>;
}
