import { useNavigate } from 'react-router-dom';
import { Plus, ArrowRight, Zap, BarChart3, FolderOpen, Trash2, Activity, Mail, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useProjects, useDeleteProject, useDashboardStats, useEVModels, useRecentSimulations } from '@/lib/api';
import type { RecentSimulation } from '@/lib/api';
import { useProjectStore } from '@/store/projectStore';
import { formatDate } from '@/lib/utils';
import KPICard from '@/components/shared/KPICard';

export default function Dashboard() {
  const navigate = useNavigate();
  const { data: projects, isLoading } = useProjects();
  const { data: stats } = useDashboardStats();
  const { data: evModels } = useEVModels();
  const evModelCount = evModels?.length ?? 0;
  const { data: recentSims } = useRecentSimulations();
  const simList: RecentSimulation[] = Array.isArray(recentSims) ? recentSims : [];
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
          <h1 className="text-2xl font-light text-[#001141]">Dashboard</h1>
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
          className="cursor-pointer hover:border-[#0079C0] hover:shadow-md transition-all group"
          onClick={() => navigate('/projekte/neu')}
        >
          <CardContent className="pt-6 pb-4">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded bg-[#e6f3fc] text-[#0079C0] group-hover:bg-[#cce6f8] transition-colors">
                <Plus className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-normal text-[#001141]">Analyse starten</h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  Neues Projekt mit dem Wizard einrichten
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:border-[#043F2E] hover:shadow-md transition-all group"
          onClick={() => navigate('/fahrzeuge')}
        >
          <CardContent className="pt-6 pb-4">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded bg-[#e8f5f0] text-[#043F2E] group-hover:bg-[#d0ebdf] transition-colors">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-normal text-[#001141]">EV-Modelle erkunden</h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  {evModelCount > 0 ? `Bibliothek mit ${evModelCount} aktuellen Fahrzeugmodellen` : 'EV-Fahrzeugbibliothek laden…'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-all">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded bg-[#e6f3fc] text-[#0079C0]">
                <BarChart3 className="h-4 w-4" />
              </div>
              <h3 className="font-normal text-[#001141] text-sm">Berichte & Export</h3>
            </div>
            {simList.length === 0 ? (
              <p className="text-xs text-slate-400 py-2 text-center">Noch keine abgeschlossenen Simulationen</p>
            ) : (
              <div className="space-y-2">
                {simList.map((sim) => (
                  <div key={sim.run_id} className="flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-600 truncate flex-1">{sim.project_name}</span>
                    <div className="flex gap-1 shrink-0">
                      <a
                        href={`/api/exports/results/${sim.run_id}/csv`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-[10px] px-2 py-0.5 rounded border border-slate-200 text-slate-500 hover:bg-[#e6f3fc] hover:text-[#0079C0] hover:border-[#0079C0] transition-colors"
                      >
                        CSV
                      </a>
                      <a
                        href={`/api/exports/results/${sim.run_id}/xlsx`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-[10px] px-2 py-0.5 rounded border border-slate-200 text-slate-500 hover:bg-[#e8f5f0] hover:text-[#043F2E] hover:border-[#043F2E] transition-colors"
                      >
                        XLSX
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Projects */}
      <div>
        <h2 className="text-lg font-normal text-[#001141] mb-3">Aktuelle Projekte</h2>

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
                      <div className="w-10 h-10 rounded bg-gradient-to-br from-[#0079C0] to-[#001141] flex items-center justify-center text-white font-bold text-sm">
                        {project.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-normal text-[#001141]">{project.name}</h3>
                          {project.wizard_module === 'reichweiten' && (
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#e8f5f0] text-[#043F2E] border border-green-200">
                              Reichweiten Simulator
                            </span>
                          )}
                          {project.wizard_module === 'ladeprozess' && (
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#e6f3fc] text-[#0079C0] border border-blue-200">
                              Ladeprozess Simulator
                            </span>
                          )}
                          {project.wizard_module === 'ladeprozess_optimierung' && (
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#e8f5f0] text-[#043F2E] border border-emerald-200">
                              Ladeoptimierung
                            </span>
                          )}
                          {project.wizard_module === 'ladeprozess_bidirektional' && (
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                              Bidirektional & Arbitrage
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

      {/* iE2S Kontakt Banner */}
      <Card className="border-[#043F2E] bg-[#043F2E]">
        <CardContent className="py-5 px-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h4 className="font-light text-white text-base">Haben Sie Fragen zu Ihrer Flottenelektrifizierung?</h4>
              <p className="text-white/70 text-sm mt-1">
                Unsere Experten begleiten Sie von der Analyse bis zur Umsetzung.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
              <a
                href="mailto:info@ie2s.com"
                className="flex items-center gap-2 px-4 py-2 bg-white text-[#043F2E] rounded text-sm font-medium hover:bg-[#e8f5f0] transition-colors"
              >
                <Mail className="h-4 w-4" />
                info@ie2s.com
              </a>
              <a
                href="https://ie2s.com/de"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-transparent border border-white/40 text-white rounded text-sm font-normal hover:bg-white/10 transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                ie2s.com
              </a>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
