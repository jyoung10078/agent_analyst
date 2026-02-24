import { useState, useEffect } from 'react';
import { getCurrentUser, signIn, signOut, signUp, confirmSignUp, AuthUser } from 'aws-amplify/auth';

export interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  error: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    getCurrentUser()
      .then((user) => setState({ user, isLoading: false, error: null }))
      .catch(() => setState({ user: null, isLoading: false, error: null }));
  }, []);

  const login = async (email: string, password: string) => {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      await signIn({ username: email, password });
      const user = await getCurrentUser();
      setState({ user, isLoading: false, error: null });
    } catch (err) {
      setState((s) => ({ ...s, isLoading: false, error: (err as Error).message }));
      throw err;
    }
  };

  const register = async (email: string, password: string) => {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      await signUp({ username: email, password, options: { userAttributes: { email } } });
      setState((s) => ({ ...s, isLoading: false }));
    } catch (err) {
      setState((s) => ({ ...s, isLoading: false, error: (err as Error).message }));
      throw err;
    }
  };

  const confirm = async (email: string, code: string) => {
    await confirmSignUp({ username: email, confirmationCode: code });
  };

  const logout = async () => {
    await signOut();
    setState({ user: null, isLoading: false, error: null });
  };

  return { ...state, login, register, confirm, logout };
}
