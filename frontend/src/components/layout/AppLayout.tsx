import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { TooltipProvider } from '@/components/ui/tooltip';

export default function AppLayout() {
  return (
    <TooltipProvider>
      <div className="flex h-screen overflow-hidden bg-slate-50">
        {/* Sidebar */}
        <Sidebar />

        {/* Main content area */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto">
            <div className="min-h-full p-6">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
