import React, { createContext, useEffect, useState, useContext } from "react";
import { auth } from "@/lib/firebase";
import {
  User,
  UserCredential,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { Loader2 } from "lucide-react";

interface AuthContextValue {
  currentUser: User | null;
  loginWithGoogle: () => Promise<UserCredential>;
  logout: () => Promise<void>;
  loading: boolean;
}

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  function loginWithGoogle() {
    if (!auth) throw new Error("Firebase auth not initialized");
    const provider = new GoogleAuthProvider();
    return signInWithPopup(auth, provider);
  }

  function logout() {
    if (!auth) throw new Error("Firebase auth not initialized");
    return signOut(auth);
  }

  useEffect(() => {
    const firebaseAuth = auth;
    if (!firebaseAuth) {
      console.error("Firebase auth is not initialized");
      const timer = setTimeout(() => setLoading(false), 0);
      return () => clearTimeout(timer);
    }

    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value: AuthContextValue = {
    currentUser,
    loginWithGoogle,
    logout,
    loading,
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-2">
        <Loader2 className="h-12 w-12 animate-spin" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
