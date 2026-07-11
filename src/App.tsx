import { useEffect, useState } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import Index from "./pages/Index";
import BoardPage from "./pages/BoardPage";
import ReportsPage from "./pages/ReportsPage";
import SettingsPage from "./pages/SettingsPage";
import WebinarsPage from "./pages/WebinarsPage";
import HerramientasPage from "./pages/HerramientasPage";
import NotFound from "./pages/NotFound";
import FactoryPage from "./pages/factory/FactoryPage";
import VersionUpdateBanner from "./components/VersionUpdateBanner";

const queryClient = new QueryClient();

const AppRoutes = () => {
  const { initialize } = useAuthStore();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    initialize().then(() => setInitialized(true));
  }, [initialize]);

  if (!initialized) {
    return null;
  }

  return (
    <Routes>
      <Route path="/" element={<FactoryPage />} />
      <Route path="/factory" element={<Navigate to="/" replace />} />
      <Route path="/inicio" element={<Index />} />
      <Route path="/board/:boardId" element={<BoardPage />} />
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
