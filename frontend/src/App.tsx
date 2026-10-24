import { BrowserRouter, HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import RoleRoute from './components/RoleRoute';
import LoginPage from './pages/auth/login';
import RegisterPage from './pages/auth/register';
import SetupPage from './pages/auth/setup';
import DashboardPage from './pages/shared/dashboard-home';
import TimeEntryPage from './pages/consultant/time-entry';
import BulkTimeEntryPage from './pages/consultant/bulk-time-entry';
import TimeEntriesListPage from './pages/consultant/time-entries-list';
import DashboardManagerPage from './pages/manager/dashboard';
import CalendarImportPage from './pages/consultant/calendar-import';
import AdminBulkOperationsPage from './pages/admin/bulk-operations';
import AdminTemporaryUnlocksPage from './pages/admin/temporary-unlocks';
import TimeEntryCorrectionsPage from './pages/cross-role/time-entry-corrections';
import DesktopNotificationManager from './components/DesktopNotificationManager';
import { CapabilitiesProvider } from './contexts/CapabilitiesContext';
import { useLocale } from './i18n';
import BalancesPage from './pages/cross-role/balances/BalancesPage';
import ClosingPage from './pages/cross-role/closing/ClosingPage';

import {
  PeopleWorkspace,
  ClientsWorkspace,
  ReportsWorkspace,
  SettingsWorkspace,
} from './pages/shared/workspace/WorkspacePages';
import LayoutPreviewPage from './pages/dev/LayoutPreviewPage';

// No desktop o app e servido via file://, onde location.pathname e o caminho do
// arquivo (ex.: /C:/.../index.html) e nenhuma rota casaria. HashRouter resolve isso.
const isDesktop =
  typeof window !== 'undefined' &&
  (window.desktopRuntime?.isDesktop || window.location.protocol === 'file:');
const Router = isDesktop ? HashRouter : BrowserRouter;
function LegacyRedirect({ to }: { to: string }) {
  const { search } = useLocation();
  const [pathname, query] = to.split('?');
  const params = new URLSearchParams(search);
  new URLSearchParams(query).forEach((value, key) => params.set(key, value));
  return <Navigate to={{ pathname, search: params.toString() }} replace />;
}

function App() {
  useLocale();
  return (
    <ThemeProvider>
      <Router>
        <AuthProvider>
          <CapabilitiesProvider>
            <DesktopNotificationManager />
            <Routes>
              <Route
                path="/people"
                element={
                  <ProtectedRoute>
                    <PeopleWorkspace />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/clients"
                element={
                  <ProtectedRoute>
                    <ClientsWorkspace />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reports"
                element={
                  <ProtectedRoute>
                    <ReportsWorkspace />
                  </ProtectedRoute>
                }
              />
              <Route path="/access" element={<LegacyRedirect to="/settings?tab=access" />} />
              <Route
                path="/balances"
                element={
                  <ProtectedRoute>
                    <BalancesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/closing"
                element={
                  <ProtectedRoute>
                    <ClosingPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/setup" element={<SetupPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/dev/layout-preview" element={<LayoutPreviewPage />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/team"
                element={
                  <ProtectedRoute>
                    <RoleRoute allowedRoles={[1, 2]}>
                      <DashboardManagerPage />
                    </RoleRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/manager/clients"
                element={<LegacyRedirect to="/clients?tab=portfolio" />}
              />
              <Route
                path="/manager/consultants"
                element={<LegacyRedirect to="/people?tab=team" />}
              />
              <Route
                path="/admin/consultants"
                element={<LegacyRedirect to="/people?tab=allocations" />}
              />
              <Route
                path="/admin/managers"
                element={<LegacyRedirect to="/people?tab=managers" />}
              />
              <Route path="/admin/users" element={<LegacyRedirect to="/people?tab=people" />} />
              <Route path="/admin/clients" element={<LegacyRedirect to="/clients" />} />
              <Route path="/admin/audit" element={<LegacyRedirect to="/settings?tab=audit" />} />
              <Route path="/admin/reports" element={<LegacyRedirect to="/reports" />} />
              <Route
                path="/admin/hour-pool"
                element={<LegacyRedirect to="/reports?tab=billing" />}
              />
              <Route
                path="/admin/bulk"
                element={
                  <ProtectedRoute>
                    <RoleRoute allowedRoles={[1]}>
                      <AdminBulkOperationsPage />
                    </RoleRoute>
                  </ProtectedRoute>
                }
              />
              <Route path="/admin/health" element={<LegacyRedirect to="/settings?tab=health" />} />
              <Route
                path="/admin/retention"
                element={<LegacyRedirect to="/settings?tab=retention" />}
              />
              <Route
                path="/admin/temporary-unlocks"
                element={
                  <ProtectedRoute>
                    <RoleRoute allowedRoles={[1]}>
                      <AdminTemporaryUnlocksPage />
                    </RoleRoute>
                  </ProtectedRoute>
                }
              />
              <Route path="/export" element={<LegacyRedirect to="/reports?tab=export" />} />
              <Route
                path="/notifications"
                element={<LegacyRedirect to="/settings?tab=notifications" />}
              />
              <Route
                path="/integrations"
                element={<LegacyRedirect to="/settings?tab=integrations" />}
              />
              <Route
                path="/admin/access-tokens"
                element={<LegacyRedirect to="/settings?tab=tokens" />}
              />
              <Route
                path="/time-entries/new"
                element={
                  <ProtectedRoute>
                    <TimeEntryPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/time-entries/:id/edit"
                element={
                  <ProtectedRoute>
                    <TimeEntryPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/time-entries/bulk"
                element={
                  <ProtectedRoute>
                    <BulkTimeEntryPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/calendar-import"
                element={
                  <ProtectedRoute>
                    <RoleRoute allowedRoles={[2, 3]}>
                      <CalendarImportPage />
                    </RoleRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/time-entries"
                element={
                  <ProtectedRoute>
                    <TimeEntriesListPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/time-entries/corrections"
                element={
                  <ProtectedRoute>
                    <RoleRoute allowedRoles={[1, 2]}>
                      <TimeEntryCorrectionsPage />
                    </RoleRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <SettingsWorkspace />
                  </ProtectedRoute>
                }
              />
              <Route path="/" element={<LoginPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </CapabilitiesProvider>
        </AuthProvider>
      </Router>
    </ThemeProvider>
  );
}

export default App;
