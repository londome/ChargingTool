import { useNavigate } from 'react-router-dom';
import { Plus, ArrowRight, Zap, Truck, BarChart3, FolderOpen, Trash2, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useProjects, useDeleteProject, useDashboardStats } from '@/lib/api';
import { useProjectStore } from '@/store/projectStore';
import { formatDate } from '@/lib/utils';
import KPICard from '@/components/shared/KPICard';

export default function Dashboard() {
  const navigate = useNavigate();
  const { data: projects, isLoading } = useProjects();
  const { data: stats } = useDashboardStats();
  const { setActiveProject, activeProject } = useProjectStore();
  const deleteProject = useDeleteProject();

  const projectList = Array.isArray(projects) ? projects : [];

  const handleOpenProject = (projectId: string) => {
    const project = projectList.find(p => p.id === projectId);
    if (project) setActiveProject(project);
    navigate(`/projekte/${projectId}/wizard`);
  };

  const handleDeleteProject = (projectId: string, projectName: string) => {
    if (!window.confirm(`Projekt „${projectName}" wirklich löschen? Alle Simulationen und Daten werden unwiderruflich entfernt.`)) return;
    deleteProject.mutate(projectId, {
      onSuccess: () => {
        if (activeProject?.id === projectId) setActiveProject(null);
      },
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">
            Übersicht Ihrer Flottenelektrifizierungs-Analysen
          </p>
        </div>
        <Button onClick={() => navigate('/projekte/neu')} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Neues Projekt
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Projekte"
          value={isLoading ? '...' : String(projectList.length)}
          unit="gesamt"
          icon={FolderOpen}
          color="blue"
        />
        <KPICard
          title="Fahrzeuge erfasst"
          value={stats ? String(stats.vehicle_count) : '–'}
          unit="gesamt"
          icon={Truck}
          color="blue"
          tooltip="Gesamtanzahl erfasster Fahrzeuge über alle Projekte"
        />
        <KPICard
          title="Simulationen"
          value={stats ? String(stats.simulation_count) : '–'}
          unit="abgeschlossen"
          icon={Activity}
          color="green"
          tooltip="Anzahl erfolgreich abgeschlossener Simulationen"
        />
        <KPICard
          title="Letzte Aktivität"
          value={stats?.last_activity ? formatDate(stats.last_activity) : '–'}
          unit=""
          icon={BarChart3}
          color="amber"
          tooltip="Datum des zuletzt erstellten Projekts"
        />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card
          className="cursor-pointer hover:border-blue-300 hover:shadow-md transition-all group"
          onClick={() => navigate('/projekte/neu')}
        >
          <CardContent className="pt-6 pb-4">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-100 transition-colors">
                <Plus className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Analyse starten</h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  Neues Projekt mit dem Wizard einrichten
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:border-green-300 hover:shadow-md transition-all group"
          onClick={() => navigate('/fahrzeuge')}
        >
          <CardContent className="pt-6 pb-4">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-lg bg-green-50 text-green-600 group-hover:bg-green-100 transition-colors">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">EV-Modelle erkunden</h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  Bibliothek mit 17 aktuellen Fahrzeugmodellen
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:border-purple-300 hover:shadow-md transition-all">
          <CardContent className="pt-6 pb-4">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Berichte</h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  Exportieren Sie Analysen als XLSX oder CSV
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Projects */}
      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-3">Aktuelle Projekte</h2>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        ) : projectList.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FolderOpen className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-slate-600 font-medium">Noch keine Projekte</h3>
              <p className="text-slate-400 text-sm mt-1 mb-4">
                Starten Sie Ihre erste Flottenelektrifizierungs-Analyse
              </p>
              <Button onClick={() => navigate('/projekte/neu')}>
                <Plus className="h-4 w-4 mr-2" />
                Erstes Projekt erstellen
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {projectList.slice(0, 5).map((project) => (
              <Card key={project.id} className="hover:shadow-md transition-shadow">
                <CardContent className="py-4 px-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-sm">
                        {project.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-slate-900">{project.name}</h3>
                          {project.wizard_module === 'reichweiten' && (
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
                              Reichweiten Simulator
                            </span>
                          )}
                          {project.wizard_module === 'ladeprozess' && (
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                              Ladeprozess Simulator
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400">
                          {project.industry} · {project.depot_location} · Erstellt {formatDate(project.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{project.country}</Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenProject(project.id)}
                        className="flex items-center gap-1"
                      >
                        Öffnen
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteProject(project.id, project.name)}
                        disabled={deleteProject.isPending}
                        className="text-slate-400 hover:text-red-600 hover:bg-red-50 px-2"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Info banner */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="py-4 px-5">
          <div className="flex items-start gap-3">
            <Zap className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
            <div>
              <h4 className="font-semibold text-blue-900 text-sm">Flottenelektrifizierung – Schritt für Schritt</h4>
              <p className="text-blue-700 text-sm mt-0.5">
                Erstellen Sie ein Projekt, erfassen Sie Ihre Flottenfahrzeuge, laden Sie Tourdaten hoch,
                konfigurieren Sie Szenarien und starten Sie die Simulation für vollständige TCO- und CO₂-Analysen.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
