import { AuthProvider, useAuth } from './context/AuthContext';
import { ClubsProvider } from './context/ClubsContext';
import { ThemeProvider } from './context/ThemeContext';
import { LegalProvider } from './context/LegalContext';
import { RefreshCcw } from 'lucide-react';
import AuthScreen from './components/auth/AuthScreen';
import ClubShell from './components/layout/ClubShell';
import CookieConsent from './components/legal/CookieConsent';

function AppGate() {
  const { user, loadingApp } = useAuth();

  if (loadingApp) {
    return (
      <div className="h-screen bg-canvas flex flex-col items-center justify-center overscroll-none">
        <RefreshCcw className="animate-spin text-green-500 mb-4" size={40} />
        <span className="text-fg-muted text-xs font-bold uppercase tracking-widest">Cargando aplicación...</span>
      </div>
    );
  }

  if (!user) return <AuthScreen />;

  return (
    <ClubsProvider>
      <ClubShell />
    </ClubsProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <LegalProvider>
        <AuthProvider>
          <AppGate />
        </AuthProvider>
        <CookieConsent />
      </LegalProvider>
    </ThemeProvider>
  );
}
