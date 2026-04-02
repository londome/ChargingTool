import { useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useProjectStore } from '@/store/projectStore';
import { useProjects } from '@/lib/api';
import { formatDate } from '@/lib/utils';

export default function Header() {
  const navigate = useNavigate();
  const { activeProject, setActiveProject } = useProjectStore();
  const { data: projects } = useProjects();

  const projectList = Array.isArray(projects) ? projects : [];

  return (
    <header className="flex items-center justify-between h-[60px] px-6 bg-white border-b border-slate-200 shrink-0">
      {/* Project selector */}
      <div className="flex items-center gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="flex items-center gap-2 max-w-[280px]">
              <span className="truncate text-sm">
                {activeProject ? activeProject.name : 'Projekt auswählen'}
              </span>
              <ChevronDown className="h-3 w-3 shrink-0 text-slate-400" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72">
            <DropdownMenuLabel>Projekte</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {projectList.length === 0 && (
              <div className="px-3 py-4 text-sm text-slate-500 text-center">
                Noch keine Projekte vorhanden
              </div>
            )}
            {projectList.map((project) => (
              <DropdownMenuItem
                key={project.id}
                onClick={() => {
                  setActiveProject(project);
                  navigate(`/projekte/${project.id}/wizard`);
                }}
                className={activeProject?.id === project.id ? 'bg-blue-50 text-blue-700' : ''}
              >
                <div className="flex flex-col">
                  <span className="font-medium text-sm">{project.name}</span>
                  <span className="text-xs text-slate-400">{project.industry} · {formatDate(project.created_at)}</span>
                </div>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/projekte/neu')}>
              <Plus className="h-4 w-4 mr-2 text-blue-600" />
              <span className="text-blue-600 font-medium">Neues Projekt erstellen</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {activeProject && (
          <div className="hidden md:flex items-center gap-1 text-xs text-slate-400">
            <span className="font-medium text-slate-600">{activeProject.depot_location}</span>
            <span>·</span>
            <span>{activeProject.industry}</span>
          </div>
        )}

        <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-600">
          <Bell className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-semibold">
            DB
          </div>
          <div className="hidden md:block">
            <p className="text-sm font-medium text-slate-800">Demo Benutzer</p>
            <p className="text-xs text-slate-400">demo@flotte.de</p>
          </div>
        </div>
      </div>
    </header>
  );
}
