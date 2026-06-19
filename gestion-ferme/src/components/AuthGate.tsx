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
    const domaine = import.meta.env.VITE_AUTH_EMAIL_DOMAIN?.trim();
    if (!valeurIdentifiant.includes('@') && !domaine) {
      setMessage("Le domaine de connexion n'est pas configuré.");
      setSubmitting(false);
      return;
    }
    const email = valeurIdentifiant.includes('@')
      ? valeurIdentifiant
      : domaine
        ? `${valeurIdentifiant}@${domaine}`
        : valeurIdentifiant;

    const { error } = await supabase.auth.signInWithPassword({
      email,
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
      <main className="min-h-screen flex items-center justify-center bg-stone-50 px-4">
        <section className="w-full max-w-sm rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-stone-900">Gestion SCEA La Ferme de Bernard</h1>
          <p className="mt-2 text-sm text-stone-600">
            Connectez-vous pour acceder a l'interface de gestion.
          </p>
          <form className="mt-6 space-y-4" onSubmit={handleSignIn}>
            <label className="block text-left text-sm font-medium text-stone-700">
              Identifiant
              <input
                type="text"
                value={identifiant}
                onChange={(event) => setIdentifiant(event.target.value)}
                className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-stone-900"
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
                className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-stone-900"
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
              className="w-full rounded-md bg-emerald-700 px-4 py-2 font-semibold text-white disabled:opacity-60"
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
