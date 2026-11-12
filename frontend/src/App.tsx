import { useEffect, Component } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Header } from './components/Header';
import { Home } from './pages/Home';
import { Profile } from './pages/Profile';
import { InterviewSetup } from './pages/InterviewSetup';
import { InterviewRoom } from './pages/InterviewRoom';
import { Results } from './pages/Results';
import { History } from './pages/History';
import { Practice } from './pages/Practice';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { AuthProvider, useAuth } from './context/AuthContext';
import type { ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

// ─── Error Boundary: prevents blank white screen on uncaught React errors ───
class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; errorMsg: string }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMsg: '' };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMsg: error?.message || 'Unknown error' };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', background: '#0f172a', display: 'flex',
          alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
          gap: '16px', fontFamily: 'Inter, system-ui, sans-serif', color: '#94a3b8'
        }}>
          <TriangleAlert size={40} color="#f59e0b" aria-hidden="true" />
          <h2 style={{ color: '#f8fafc', fontSize: '1.25rem', fontWeight: 600 }}>
            Something went wrong
          </h2>
          <p style={{ fontSize: '0.85rem', maxWidth: 400, textAlign: 'center' }}>
            {this.state.errorMsg}
          </p>
          <button
            onClick={() => { this.setState({ hasError: false, errorMsg: '' }); window.location.href = '/'; }}
            style={{
              marginTop: 8, padding: '12px 24px', borderRadius: 10,
              background: '#22c55e',
              color: '#0f172a', border: 'none', cursor: 'pointer', fontWeight: 600
            }}
          >
            Go back home
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Fire-and-forget: wake all downstream services the moment the app loads
// so they're ready before the user reaches any feature page.
function useWarmup() {
  useEffect(() => {
    fetch(`${API_URL}/warmup`, { method: 'GET' }).catch(() => {/* silent */});
  }, []);
}

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

function AppRoutes() {
  useWarmup();
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const isHome = location.pathname === '/';

  return (
    <div className="min-h-screen bg-bg text-ink">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-btn focus:bg-ink focus:px-4 focus:py-3 focus:font-semibold focus:text-bg">
        Skip to content
      </a>
      {isAuthenticated && <Header />}
      <main id="main" className={isAuthenticated && !isHome ? "mx-auto max-w-6xl px-4 py-10 sm:px-6" : ""}>
        <Routes>
          <Route path="/login" element={isAuthenticated ? <Navigate to="/" /> : <Login />} />
          <Route path="/signup" element={isAuthenticated ? <Navigate to="/" /> : <Signup />} />

          <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/new-interview" element={<ProtectedRoute><InterviewSetup /></ProtectedRoute>} />
          <Route path="/interview/:id" element={<ProtectedRoute><InterviewRoom /></ProtectedRoute>} />
          <Route path="/results/:id" element={<ProtectedRoute><Results /></ProtectedRoute>} />
          <Route path="/practice" element={<ProtectedRoute><Practice /></ProtectedRoute>} />
          <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
