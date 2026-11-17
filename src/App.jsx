import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import { BASE_PATH } from '@/lib/appUrl';
import React, { Suspense } from 'react';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { ThemeProvider } from '@/lib/ThemeContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Navigate } from 'react-router-dom';
import CardCreator from './pages/CardCreator';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';

const Clans = React.lazy(() => import('./pages/Clans'));
const FolderPage = React.lazy(() => import('./pages/FolderPage'));
const EntryReview = React.lazy(() => import('./pages/EntryReview'));
const RecentlyDeleted = React.lazy(() => import('./pages/RecentlyDeleted'));
const RulesPage = React.lazy(() => import('./pages/RulesPage'));
const Decks = React.lazy(() => import('./pages/Decks'));
const DeckManager = React.lazy(() => import('./pages/DeckManager'));
const PlayGame = React.lazy(() => import('./pages/PlayGame'));
const AdminImport = React.lazy(() => import('./pages/AdminImport'));

const LazyFallback = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-background">
    <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
  </div>
);

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError } = useAuth();
  const location = useLocation();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // If we're already on an auth page, render the routes instead of
      // redirecting — otherwise redirectToLogin re-wraps the current URL into
      // from_url on every load, creating an infinite /login?from_url=/login?from_url=…
      // loop that hammers the API into 429s.
      const isAuthPage = ['/login', '/register', '/forgot-password', '/reset-password'].includes(location.pathname);
      if (!isAuthPage) {
        const back = location.pathname + location.search;
        return <Navigate to={back && back !== '/' ? `/login?returnTo=${encodeURIComponent(back)}` : '/login'} replace />;
      }
    }
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/clans/review" element={<Suspense fallback={<LazyFallback />}><EntryReview /></Suspense>} />
      <Route path="/clans/recently-deleted" element={<Suspense fallback={<LazyFallback />}><RecentlyDeleted /></Suspense>} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route path="/" element={<CardCreator />} />
        <Route path="/creator" element={<CardCreator />} />
        <Route path="/clans" element={<Suspense fallback={<LazyFallback />}><Clans /></Suspense>} />
        <Route path="/clans/rules" element={<Suspense fallback={<LazyFallback />}><RulesPage /></Suspense>} />
        <Route path="/folder/:id" element={<Suspense fallback={<LazyFallback />}><FolderPage /></Suspense>} />
        <Route path="/folder/:id/rules" element={<Suspense fallback={<LazyFallback />}><RulesPage /></Suspense>} />
        <Route path="/decks" element={<Suspense fallback={<LazyFallback />}><Decks /></Suspense>} />
        <Route path="/deck/:id" element={<Suspense fallback={<LazyFallback />}><DeckManager /></Suspense>} />
        <Route path="/play" element={<Suspense fallback={<LazyFallback />}><PlayGame /></Suspense>} />
        <Route path="/play/:gameId" element={<Suspense fallback={<LazyFallback />}><PlayGame /></Suspense>} />
        <Route path="/admin/import" element={<Suspense fallback={<LazyFallback />}><AdminImport /></Suspense>} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <ThemeProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router basename={BASE_PATH || undefined}>
            <ScrollToTop />
            <AuthenticatedApp />
          </Router>
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App