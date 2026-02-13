import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AppLayout } from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Jobs from "@/pages/Jobs";
import Candidates from "@/pages/Candidates";
import Pipeline from "@/pages/Pipeline";
import Interviews from "@/pages/Interviews";
import Messages from "@/pages/Messages";
import TalentPool from "@/pages/TalentPool";
import Reports from "@/pages/Reports";
import Automations from "@/pages/Automations";
import AIAssistant from "@/pages/AIAssistant";
import SettingsPage from "@/pages/Settings";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="light">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/jobs" element={<Jobs />} />
              <Route path="/candidates" element={<Candidates />} />
              <Route path="/pipeline" element={<Pipeline />} />
              <Route path="/interviews" element={<Interviews />} />
              <Route path="/messages" element={<Messages />} />
              <Route path="/talent-pool" element={<TalentPool />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/automations" element={<Automations />} />
              <Route path="/ai-assistant" element={<AIAssistant />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
