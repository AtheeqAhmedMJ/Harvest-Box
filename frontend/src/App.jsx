import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import Nav_Bar from "./components/Nav_Bar/Nav_Bar";
import Auth from "./pages/Auth/Auth";
import ProtectedRoute from "./components/ProtectedRoute";
import AuthProvider from "./context/AuthProvider";
import ErrorBoundary from "./components/ErrorBoundary/ErrorBoundary";

// Lazy-load heavy pages
const Dashboard = lazy(() => import("./pages/Dashboard/Dashboard"));
const FieldSetup = lazy(() => import("./pages/FieldSetup/FieldSetup"));
const Reports    = lazy(() => import("./pages/Reports/Reports"));
const User       = lazy(() => import("./pages/User/User"));

const AUTH_PATHS = ["/login", "/register"];

function PageLoader() {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      minHeight: "60vh",
    }}>
      <div className="app-boot-spinner" />
    </div>
  );
}

function AppShell() {
  const { pathname } = useLocation();
  const isAuth = AUTH_PATHS.includes(pathname);
  return (
    <>
      {!isAuth && <Nav_Bar />}
      <ErrorBoundary label="Page failed to load.">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public */}
            <Route path="/login"    element={<Auth />} />
            <Route path="/register" element={<Auth />} />

            {/* Protected — lazy loaded */}
            <Route element={<ProtectedRoute />}>
              <Route path="/"            element={<Dashboard />} />
              <Route path="/field-setup" element={<FieldSetup />} />
              <Route path="/analytics"   element={<Reports />} />
              <Route path="/user"        element={<User />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </BrowserRouter>
  );
}
