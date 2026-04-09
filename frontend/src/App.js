import React from "react";
import { Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { ThemeProvider } from "./contexts/ThemeContext";

import DashboardLayout from "./components/layout/DashboardLayout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import TicketsPage from "./pages/TicketsPage";
import TicketDetailPage from "./pages/TicketDetailPage";
import SuggestionsPage from "./pages/SuggestionsPage";
import SuggestionDetailPage from "./pages/SuggestionDetailPage";
import ProjectsPage from "./pages/ProjectsPage";
import ProjectDetailPage from "./pages/ProjectDetailPage";

import UsersPage from "./pages/admin/UsersPage";
import HotelsPage from "./pages/admin/HotelsPage";
import DepartmentsPage from "./pages/admin/DepartmentsPage";
import TicketTypesPage from "./pages/admin/TicketTypesPage";
import RolesPage from "./pages/admin/RolesPage";

import TicketsReportPage from "./pages/admin/TicketsReportPage";
import HotelsMapPage from "./pages/admin/HotelsMapPage";
import SolutionTypePage from "./pages/admin/SolutionTypePage";

import "./App.css";

function App() {
  return (
    <ThemeProvider>
      {/* Sólo las rutas – sin <BrowserRouter> ni <AuthProvider> */}
      <Routes>
        {/* Rutas públicas */}
        <Route path="/login" element={<LoginPage />} />

        {/* Rutas protegidas, todas dentro del layout del dashboard */}
        <Route element={<DashboardLayout />}>
          <Route path="/" element={<DashboardPage />} />

          {/* Tickets */}
          <Route path="/tickets" element={<TicketsPage />} />
          <Route path="/tickets/:id" element={<TicketDetailPage />} />

          {/* Suggestions */}
          <Route path="/suggestions" element={<SuggestionsPage />} />
          <Route
            path="/suggestions/:id"
            element={<SuggestionDetailPage />}
          />

          {/* Projects */}
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:id" element={<ProjectDetailPage />} />

          {/* Admin */}
          <Route path="/admin/users" element={<UsersPage />} />
          <Route path="/admin/hotels" element={<HotelsPage />} />
          <Route
            path="/admin/departments"
            element={<DepartmentsPage />}
          />
          <Route
            path="/admin/ticket-types"
            element={<TicketTypesPage />}
          />
          <Route path="/admin/roles" element={<RolesPage />} />

          {/* Recursos */}
          <Route
            path="/admin/ticketsreport"
            element={<TicketsReportPage />}
          />
          <Route path="/admin/maphotels" element={<HotelsMapPage />} />
          <Route
            path="/admin/solution-type"
            element={<SolutionTypePage />}
          />
        </Route>
      </Routes>

      {/* Toaster */}
      <Toaster
        position="top-right"
      />
    </ThemeProvider>
  );
}

export default App;

