import { useEffect, useState } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import ReportsPage from "./pages/ReportsPage";
import SettingsPage from "./pages/SettingsPage";
import WebinarsPage from "./pages/WebinarsPage";
import HerramientasPage from "./pages/HerramientasPage";
import NotFound from "./pages/NotFound";
import LoginPage from "./pages/LoginPage";
import ActivarPage from "./pages/ActivarPage";
import FactoryPage from "./pages/factory/FactoryPage";
import MisTareasPage from "./pages/MisTareasPage";
import VersionUpdateBanner from "./components/VersionUpdateBanner";

const queryClient = new QueryClient();

const AppRoutes = () => {
  const { initialize, isAuthenticated } = useAuthStore();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    initialize().then(() => setInitialized(true));
  }, [initialize]);

  if (!initialized) {
    return null;
  }

  // Sin sesión, todo cae al login (incluido /board/:id y cualquier URL profunda) — salvo
  // /activar, que por definición la usa quien todavía no tiene cuenta.
  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/activar" element={<ActivarPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      {/* Con sesión abierta no tiene sentido activar nada. */}
      <Route path="/activar" element={<Navigate to="/" replace />} />
      <Route path="/" element={<FactoryPage />} />
      <Route path="/factory" element={<Navigate to="/" replace />} />
      {/* El kanban viejo (/inicio, /board/:id) se eliminó el 2026-07-29: era UI huérfana, no
          estaba en el menú y arrastraba su propio sistema de correo. Las rutas se redirigen en vez
          de dar 404 por si alguien las tiene en un marcador. */}
      <Route path="/inicio" element={<Navigate to="/" replace />} />
      <Route path="/board/:boardId" element={<Navigate to="/" replace />} />
      <Route path="/mis-tareas" element={<MisTareasPage />} />
      <Route path="/reports" element={<ReportsPage />} />
      <Route path="/webinars" element={<WebinarsPage />} />
      <Route path="/herramientas" element={<HerramientasPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <VersionUpdateBanner />
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
