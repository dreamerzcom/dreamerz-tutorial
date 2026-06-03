import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { Toaster } from "./components/ui/sonner";
import { Navbar } from "./components/Navbar";
import { Footer } from "./components/Footer";
import { SwapnaChatWidget } from "./components/SwapnaChatWidget";
import { ErrorBoundary, NotFound } from "./components/ErrorStates";

/** ErrorBoundary that auto-resets when the route changes — so "Go Home"
 *  on the error page actually drops you back into a working app. */
const RouteAwareErrorBoundary = ({ children }) => {
  const location = useLocation();
  return <ErrorBoundary resetKey={location.pathname}>{children}</ErrorBoundary>;
};
import { RequireAuth, RequireRole, RequireTrialActive } from "./components/RequireRole";
import { Landing } from "./pages/Landing";
import { LearnHub } from "./pages/LearnHub";
import { ToolJourney } from "./pages/ToolJourney";
import { SampleLesson } from "./pages/SampleLesson";
import { Parents } from "./pages/Parents";
import { Account } from "./pages/Account";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { ChangePassword } from "./pages/ChangePassword";
import { ForgotPassword } from "./pages/ForgotPassword";
import { TrialExpired } from "./pages/TrialExpired";
import { AdminPanel } from "./pages/AdminPanel";
import { ParentDashboard } from "./pages/ParentDashboard";
import { ParentStudentDetail } from "./pages/ParentStudentDetail";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { LanguageProvider } from "./hooks/useLanguage";
import { LearningProgressProvider } from "./hooks/useLearningProgress";
import { ProgressProvider } from "./hooks/useProgress";
import { useCopyProtection } from "./hooks/useCopyProtection";
import { useEffect } from "react";

/** Activates copy/print/dev-tools shortcut blocking on learning routes. */
const CopyProtectionGate = () => {
  useCopyProtection();
  return null;
};

/** Apply theme class to root element based on user preference */
const ThemeProvider = ({ children }) => {
  const { user } = useAuth();
  
  useEffect(() => {
    const theme = user?.theme || 'light';
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [user?.theme]);
  
  return children;
};

/** Scroll to top on route change */
const ScrollToTop = () => {
  const location = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);
  return null;
};

/** Redirect /tools/:toolId → /learn/ai-learning/:toolId preserving the param (default category) */
const ToolRedirect = () => {
  const { toolId } = useParams();
  return <Navigate to={`/learn/ai-learning/${toolId}`} replace />;
};

/** Redirect /learn/:toolId → /learn/ai-learning/:toolId for backward compatibility (default category) */
const CourseRedirect = () => {
  const { toolId } = useParams();
  return <Navigate to={`/learn/ai-learning/${toolId}`} replace />;
};

/** Redirect /learn/category/:categoryName → /learn/:categoryName for backward compatibility */
const CategoryRedirect = () => {
  const { categoryName } = useParams();
  return <Navigate to={`/learn/${categoryName}`} replace />;
};

/** Redirect /learn/course/:toolId → /learn/ai-learning/:toolId for backward compatibility (default category) */
const CoursePathRedirect = () => {
  const { toolId } = useParams();
  return <Navigate to={`/learn/ai-learning/${toolId}`} replace />;
};

function App() {
  // Keepalive: ping backend health endpoint every 1 minute to prevent Render from shutting down
  useEffect(() => {
    const API_BASE = (process.env.REACT_APP_BACKEND_URL || '').replace(/\/+$/, '');
    const pingBackend = async () => {
      try {
        await fetch(`${API_BASE}/api/health`, {
          method: 'GET',
          cache: 'no-store',
        });
      } catch (err) {
        // Silent fail — keepalive is best-effort
      }
    };

    // Ping immediately on mount, then every 1 minute
    pingBackend();
    const interval = setInterval(pingBackend, 1 * 60 * 1000); // 1 minute

    return () => clearInterval(interval);
  }, []);

  return (
    <GoogleOAuthProvider clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID || ""}>
    <HelmetProvider>
      <div className="App flex flex-col min-h-screen">
        <BrowserRouter>
          <ScrollToTop />
          <CopyProtectionGate />
          <AuthProvider>
          <LanguageProvider>
          <LearningProgressProvider>
          <ProgressProvider>
            <ThemeProvider>
            <RouteAwareErrorBoundary>
              <Navbar />
              <main className="flex-grow pt-16">
                <Routes>
                  {/* Primary routes */}
                  <Route path="/home" element={<Landing />} />
                  <Route path="/" element={<Navigate to="/home" replace />} />
                  {/* Public sample-lesson preview — intentionally NOT gated.
                      The landing CTA "See a sample lesson" funnels prospects
                      here so they can watch the intro video and read the
                      first lesson before being asked to sign up. */}
                  <Route path="/sample-lesson" element={<SampleLesson />} />
                  <Route path="/learn" element={<LearnHub />} />
                  <Route path="/learn/:categoryName" element={<LearnHub />} />
                  <Route path="/learn/:categoryName/:toolId" element={
                    <RequireTrialActive>
                      <ToolJourney />
                    </RequireTrialActive>
                  } />
                  <Route path="/learn/myprogress" element={
                    <RequireTrialActive>
                      <LearnHub viewMode="progress" />
                    </RequireTrialActive>
                  } />
                  <Route path="/trial-expired" element={<TrialExpired />} />
                  <Route path="/parents" element={<Parents />} />
                  <Route path="/account" element={
                    <RequireAuth>
                      <Account />
                    </RequireAuth>
                  } />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/reset-password" element={
                    <RequireAuth>
                      <ChangePassword />
                    </RequireAuth>
                  } />
                  {/* Forgot-password is intentionally NOT auth-gated —
                      a user who can't log in must be able to reach it.
                      The page supports two modes: request-link mode
                      (no ?token=) and reset-with-token mode (?token=…
                      from the email). */}
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route
                    path="/admin"
                    element={
                      <RequireRole roles={["creator", "admin"]}>
                        <AdminPanel />
                      </RequireRole>
                    }
                  />

                  {/* Parent dashboard routes */}
                  <Route
                    path="/parents/dashboard"
                    element={
                      <RequireRole roles={["supervisor", "admin", "creator"]}>
                        <ParentDashboard />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/parents/dashboard/students/:studentUserId"
                    element={
                      <RequireRole roles={["supervisor", "admin"]}>
                        <ParentStudentDetail />
                      </RequireRole>
                    }
                  />

                  {/* Backward-compatible redirects */}
                  <Route path="/tools" element={<Navigate to="/learn" replace />} />
                  <Route path="/tools/:toolId" element={<ToolRedirect />} />
                  <Route path="/learn/:toolId" element={<CourseRedirect />} />
                  <Route path="/learn/category/:categoryName" element={<CategoryRedirect />} />
                  <Route path="/learn/course/:toolId" element={<CoursePathRedirect />} />
                  <Route path="/myprogress" element={<Navigate to="/learn/myprogress" replace />} />
                  <Route path="/curriculum" element={<Navigate to="/learn" replace />} />
                  <Route path="/prompt-lab" element={<Navigate to="/learn" replace />} />
                  <Route path="/profile" element={<Navigate to="/account" replace />} />
                  <Route path="/settings" element={<Navigate to="/account" replace />} />
                  <Route path="/parent" element={<Navigate to="/parents/dashboard" replace />} />
                  <Route path="/parentdashboard" element={<Navigate to="/parents/dashboard" replace />} />

                  <Route path="*" element={<NotFound />} />
                </Routes>
              </main>
              <Footer />
              <SwapnaChatWidget />
            </RouteAwareErrorBoundary>
            </ThemeProvider>
            <Toaster position="bottom-right" />
          </ProgressProvider>
          </LearningProgressProvider>
          </LanguageProvider>
          </AuthProvider>
        </BrowserRouter>
      </div>
    </HelmetProvider>
    </GoogleOAuthProvider>
  );
}

export default App;
