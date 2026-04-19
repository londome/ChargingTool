import { useNavigate } from 'react-router-dom';
import { Plus, ArrowRight, BarChart3, FolderOpen, Trash2, Mail, ExternalLink } from 'lucide-react';
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
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <KPICard
          title="Flottenanalysen"
          value={isLoading ? '...' : String(projectList.length)}
          unit="gesamt"
          icon={FolderOpen}
          color="blue"
          tooltip="Anzahl erstellter Flottenanalysen (Standorte / Fahrzeugtypen)"
        />
        <KPICard
          title="Letzte Aktivität"
          value={stats?.last_activity ? formatDate(stats.last_activity) : '–'}
          unit=""
          icon={BarChart3}
          color="amber"
          tooltip="Datum der zuletzt erstellten Analyse"
        />
      </div>

      {/* Quick actions — zwei Buttons */}
      <div className="flex gap-3">
        <button
          onClick={() => navigate('/projekte/neu')}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#0079C0] text-white rounded text-sm font-normal hover:bg-[#005fa3] transition-colors"
        >
          <Plus className="h-4 w-4" />
          Analyse starten
        </button>

        <div className="relative group">
          <button className="flex items-center gap-2 px-5 py-2.5 border border-slate-300 text-[#001141] rounded text-sm font-normal hover:border-[#0079C0] hover:text-[#0079C0] transition-colors bg-white">
            <BarChart3 className="h-4 w-4" />
            Berichte & Export
          </button>
          {/* Dropdown */}
          <div className="absolute left-0 top-full mt-1 w-72 bg-white border border-slate-200 rounded shadow-lg z-10 hidden group-hover:block">
            <div className="p-3">
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
                          className="text-[10px] px-2 py-0.5 rounded border border-slate-200 text-slate-500 hover:bg-[#e6f3fc] hover:text-[#0079C0] hover:border-[#0079C0] transition-colors"
                        >
                          CSV
                        </a>
                        <a
                          href={`/api/exports/results/${sim.run_id}/xlsx`}
                          className="text-[10px] px-2 py-0.5 rounded border border-slate-200 text-slate-500 hover:bg-[#e8f5f0] hover:text-[#043F2E] hover:border-[#043F2E] transition-colors"
                        >
                          XLSX
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Flottenanalysen */}
      <div>
        <h2 className="text-lg font-normal text-[#001141] mb-3">Meine Flottenanalysen</h2>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        ) : projectList.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <FolderOpen className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-slate-600 font-normal">Noch keine Flottenanalyse erstellt</h3>
              <p className="text-slate-400 text-sm mt-2 mb-1 max-w-md mx-auto">
                Erstellen Sie eine Analyse pro Standort oder Fahrzeugtyp — z.B. <em>„Transporter Depot Nord"</em> oder <em>„LKW Fernverkehr Süd"</em>.
              </p>
              <p className="text-slate-400 text-xs mb-5">Jede Analyse enthält eine Flotte, Routen und Simulationsergebnisse.</p>
              <Button onClick={() => navigate('/projekte/neu')}>
                <Plus className="h-4 w-4 mr-2" />
                Erste Analyse starten
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
                      <div className="w-10 h-10 rounded bg-gradient-to-br from-[#0079C0] to-[#001141] flex items-center justify-center text-white font-bold text-sm shrink-0">
                        {project.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-normal text-[#001141]">{project.name}</h3>
                          {project.wizard_module === 'reichweiten' && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#e8f5f0] text-[#043F2E] border border-green-200">
                              Reichweiten-Analyse
                            </span>
                          )}
                          {project.wizard_module === 'ladeprozess' && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#e6f3fc] text-[#0079C0] border border-blue-200">
                              Ladeinfrastruktur
                            </span>
                          )}
                          {project.wizard_module === 'ladeprozess_optimierung' && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#e8f5f0] text-[#043F2E] border border-emerald-200">
                              Ladeoptimierung
                            </span>
                          )}
                          {project.wizard_module === 'ladeprozess_bidirektional' && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                              V2G / Bidirektional
                            </span>
                          )}
                          {(!project.wizard_module || project.wizard_module === 'flotte_elektrifizierung') && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#e6f3fc] text-[#0079C0] border border-blue-200">
                              Flottenelektrifizierung
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {[project.fleet_type, project.depot_location, project.industry].filter(Boolean).join(' · ')}
                          <span className="ml-2 text-slate-300">Erstellt {formatDate(project.created_at)}</span>
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
