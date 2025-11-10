// import { Toaster } from '@/components/ui/sonner';
// import { TooltipProvider } from '@/components/ui/tooltip';
// import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// import { BrowserRouter, Routes, Route } from 'react-router-dom';
// import Index from './pages/Index';
// import Projects from './pages/ Projects'
// import Scanner from './pages/Scanner';
// import Dashboard from './pages/ Dashboard';
// import Findings from './pages/Findings';
// import NotFound from './pages/NotFound';

// const queryClient = new QueryClient();

// const App = () => (
//   <QueryClientProvider client={queryClient}>
//     <TooltipProvider>
//       <Toaster />
//       <BrowserRouter>
//         <Routes>
//           <Route path="/" element={<Index />} />
//           <Route path="/projects" element={<Projects />} />
//           <Route path="/scanner" element={<Scanner />} />
//           <Route path="/dashboard" element={<Dashboard />} />
//           <Route path="/findings" element={<Findings />} />
//           <Route path="*" element={<NotFound />} />
//         </Routes>
//       </BrowserRouter>
//     </TooltipProvider>
//   </QueryClientProvider>
// );

// export default App;







import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

// Import pages
import Index from "./pages/Index";
import Projects from "./pages/Projects";
import Scanner from "./pages/Scanner";
import Dashboard from "./pages/Dashboard";
import Findings from "./pages/Findings";
import Observability from "./pages/Observability";
import Chat from "./pages/Chat";
import Defense from "./pages/Defense";
import NotFound from "./pages/NotFound";

// Placeholder for ShadCN Toaster
function Toaster() {
  return null; // or <div>Toaster placeholder</div>
}

// Placeholder for ShadCN TooltipProvider
function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

const queryClient = new QueryClient();

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/scanner" element={<Scanner />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/findings" element={<Findings />} />
            <Route path="/observability" element={<Observability />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/defense" element={<Defense />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
