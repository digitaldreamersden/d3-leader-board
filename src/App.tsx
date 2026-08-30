import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { TeamsProvider } from "@/contexts/TeamsContext";
import { TimerProvider } from "@/contexts/TimerContext";
import { MilestonesProvider } from "@/contexts/MilestonesContext";
import Sidebar from "./components/Sidebar";
import Index from "./pages/Index";
import Teams from "./pages/Teams";
import Milestones from "./pages/Milestones";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <MilestonesProvider>
          <TeamsProvider>
            <TimerProvider>
              <BrowserRouter>
                <Sidebar>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/teams" element={<Teams />} />
                    <Route path="/milestones" element={<Milestones />} />
                    {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Sidebar>
              </BrowserRouter>
            </TimerProvider>
          </TeamsProvider>
        </MilestonesProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
