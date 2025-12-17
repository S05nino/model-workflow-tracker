import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Shared team account credentials
const SHARED_EMAIL = "team@mlworkflow.local";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (password: string): Promise<{ error: Error | null }> => {
    // First validate the shared password against the database
    const { data: isValid, error: validateError } = await supabase.rpc(
      "validate_shared_password",
      { input_password: password }
    );

    if (validateError) {
      return { error: new Error("Errore di validazione password") };
    }

    if (!isValid) {
      return { error: new Error("Password non valida") };
    }

    // Password is valid - sign in with Supabase Auth
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: SHARED_EMAIL,
      password: password,
    });

    if (signInError) {
      // If user doesn't exist, try to sign up first
      if (signInError.message.includes("Invalid login credentials")) {
        const { error: signUpError } = await supabase.auth.signUp({
          email: SHARED_EMAIL,
          password: password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
          },
        });

        if (signUpError) {
          return { error: new Error("Errore durante la registrazione") };
        }

        // Try signing in again after signup
        const { error: retryError } = await supabase.auth.signInWithPassword({
          email: SHARED_EMAIL,
          password: password,
        });

        if (retryError) {
          return { error: new Error("Errore durante l'accesso") };
        }
      } else {
        return { error: new Error(signInError.message) };
      }
    }

    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
