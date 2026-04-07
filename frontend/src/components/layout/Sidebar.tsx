import { NavLink, useParams, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, FolderOpen, Truck, Route, BarChart3,
  Zap, Settings, ChevronLeft, ChevronRight,
  Building2, FlaskConical, Gauge, Battery, BatteryCharging,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProjectStore } from '@/store/projectStore';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  exact?: boolean;
}

const staticNavItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, exact: true },
  { label: 'EV-Modelle', href: '/fahrzeuge', icon: Zap },
];

function ProjectNavItems({ projectId }: { projectId: string }) {
  const location = useLocation();
  const { activeProject } = useProjectStore();
  const isResultsActive =
    location.pathname.includes(`/projekte/${projectId}/ergebnisse`);
  const isReichweitenModule = activeProject?.wizard_module === 'reichweiten';
  const isOptimierungModule = activeProject?.wizard_module === 'ladeprozess_optimierung';
  const isBidirektionalModule = activeProject?.wizard_module === 'ladeprozess_bidirektional';

  const topItems = [
    { label: 'Projekt-Wizard', href: `/projekte/${projectId}/wizard`, icon: FolderOpen },
  ];

  const settingsItems = [
    { label: 'Szenarien', href: `/projekte/${projectId}/szenarien`, icon: FlaskConical },
  ];

  const resultItems = [
    { label: 'Flottenergebnisse', href: `/projekte/${projectId}/ergebnisse`, icon: BarChart3, exact: true },
    { label: 'Tourenanalyse', href: `/projekte/${projectId}/ergebnisse/touren`, icon: Route },
    ...(!isReichweitenModule
      ? [{ label: 'Infrastruktur', href: `/projekte/${projectId}/ergebnisse/infrastruktur`, icon: Building2 }]
      : []),
  ];

  return (
    <div className="mt-4">
      <p className="px-3 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">Aktuelles Projekt</p>
      {topItems.map((item) => (
        <NavLink
          key={item.href}
          to={item.href}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
              isActive
                ? 'bg-blue-50 text-blue-700 font-semibold'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            )
          }
        >
          <item.icon className="h-4 w-4 shrink-0" />
          <span>{item.label}</span>
        </NavLink>
      ))}

      {/* Einstellungen section */}
      <div className="mt-4">
        <p className="px-3 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Settings className="h-3 w-3" /> Einstellungen
        </p>
        {settingsItems.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-50 text-blue-700 font-semibold'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              )
            }
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>

      {/* Ergebnisse section */}
      {isReichweitenModule ? (
        /* Reichweiten module: show only dedicated results page */
        <div className="mt-4">
          <p className="px-3 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <BarChart3 className="h-3 w-3" /> Ergebnisse
          </p>
          <NavLink
            to={`/projekte/${projectId}/ergebnisse/reichweiten`}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-50 text-blue-700 font-semibold'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              )
            }
          >
            <Gauge className="h-4 w-4 shrink-0" />
            <span>Reichweiten Analyse</span>
          </NavLink>
        </div>
      ) : isOptimierungModule ? (
        /* Ladeprozess Optimierung module: show dedicated results page */
        <div className="mt-4">
          <p className="px-3 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <BarChart3 className="h-3 w-3" /> Ergebnisse
          </p>
          <NavLink
            to={`/projekte/${projectId}/ergebnisse/optimierung`}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-green-50 text-green-700 font-semibold'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              )
            }
          >
            <Zap className="h-4 w-4 shrink-0" />
            <span>Ladeoptimierung</span>
          </NavLink>
        </div>
      ) : isBidirektionalModule ? (
        /* Bidirektional module: show only Energiearbitrage */
        <div className="mt-4">
          <p className="px-3 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <BarChart3 className="h-3 w-3" /> Ergebnisse
          </p>
          <NavLink
            to={`/projekte/${projectId}/ergebnisse/arbitrage`}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-purple-50 text-purple-700 font-semibold'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              )
            }
          >
            <BatteryCharging className="h-4 w-4 shrink-0" />
            <span>Energiearbitrage</span>
          </NavLink>
        </div>
      ) : (
      <div className={cn(
        'mt-1 rounded-md',
        isResultsActive ? 'bg-slate-50' : ''
      )}>
        <div className="flex items-center gap-3 px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
          <BarChart3 className="h-3.5 w-3.5 shrink-0" />
          <span>Ergebnisse</span>
        </div>
        {resultItems.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            end={item.exact}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 pl-6 pr-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-50 text-blue-700 font-semibold'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
              )
            }
          >
            <item.icon className="h-3.5 w-3.5 shrink-0" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  const { sidebarCollapsed, toggleSidebar, activeProject } = useProjectStore();
  const params = useParams();
  const projectId = params.projectId || activeProject?.id;

  return (
    <aside
      className={cn(
        'flex flex-col h-full bg-white border-r border-slate-200 transition-all duration-200',
        sidebarCollapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-4 border-b border-slate-200 min-h-[60px]">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 shrink-0">
          <Zap className="w-4 h-4 text-white" />
        </div>
        {!sidebarCollapsed && (
          <div>
            <p className="text-sm font-bold text-slate-900 leading-tight">FleetElect</p>
            <p className="text-xs text-slate-400 leading-tight">Elektrifizierung</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
        {staticNavItems.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            end={item.exact}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-50 text-blue-700 font-semibold'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                sidebarCollapsed && 'justify-center'
              )
            }
            title={sidebarCollapsed ? item.label : undefined}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {!sidebarCollapsed && <span>{item.label}</span>}
          </NavLink>
        ))}

        {/* New Project Button */}
        {!sidebarCollapsed && (
          <NavLink
            to="/projekte/neu"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-50 text-blue-700 font-semibold'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              )
            }
          >
            <FolderOpen className="h-4 w-4 shrink-0" />
            <span>Neues Projekt</span>
          </NavLink>
        )}

        {/* Project-specific nav */}
        {!sidebarCollapsed && projectId && (
          <ProjectNavItems projectId={projectId} />
        )}
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-slate-200 p-2">
        <button
          onClick={toggleSidebar}
          className="flex items-center justify-center w-full p-2 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          title={sidebarCollapsed ? 'Seitenleiste ausklappen' : 'Seitenleiste einklappen'}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <div className="flex items-center gap-2">
              <ChevronLeft className="h-4 w-4" />
              <span className="text-xs">Einklappen</span>
            </div>
          )}
        </button>
      </div>
    </aside>
  );
}
