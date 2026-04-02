import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, Play, Copy, Trash2, Edit } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import { useScenarios, useCreateScenario, useDeleteScenario, useDuplicateScenario, useRunSimulation, useUpdateScenario } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Scenario, ScenarioType } from '@shared/types';
import { getScenarioTypeLabel, formatCurrency } from '@/lib/utils';

export default function ScenarioManager() {
  const { projectId } = useParams<{ projectId: string }>();
  const { setActiveScenarioId, setActiveRunId } = useProjectStore();
  const { data: scenarios, isLoading } = useScenarios(projectId);
  const createScenario = useCreateScenario();
  const deleteScenario = useDeleteScenario();
  const duplicateScenario = useDuplicateScenario();
  const runSimulation = useRunSimulation();
  const updateScenario = useUpdateScenario();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editScenario, setEditScenario] = useState<Scenario | null>(null);
  const [newScenario, setNewScenario] = useState<Partial<Scenario>>({
    name: 'Neues Szenario',
    type: ScenarioType.CUSTOM,
    electricity_price: 0.28,
    diesel_price: 1.75,
    grid_emission_factor: 0.380,
    charging_power_kw: 22,
    charging_efficiency: 0.92, allow_public_charging: false,
    winter_surcharge: 0.15, temperature_factor: 1.0, electrification_pct: 100,
  });

  const scenarioList = Array.isArray(scenarios) ? scenarios : [];

  const handleCreate = async () => {
    if (!projectId) return;
    await createScenario.mutateAsync({ ...newScenario, project_id: projectId });
    setShowCreateDialog(false);
  };

  const handleRun = async (scenarioId: string) => {
    if (!projectId) return;
    const run = await runSimulation.mutateAsync({ project_id: projectId, scenario_id: scenarioId });
    setActiveScenarioId(scenarioId);
    setActiveRunId(run.run_id);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Szenario wirklich löschen?')) {
      await deleteScenario.mutateAsync(id);
    }
  };

  const typeColors: Record<ScenarioType, 'default' | 'success' | 'warning' | 'secondary'> = {
    [ScenarioType.BASELINE]: 'secondary',
    [ScenarioType.OPTIMISTIC]: 'success',
    [ScenarioType.CONSERVATIVE]: 'warning',
    [ScenarioType.CUSTOM]: 'default',
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Szenarien</h1>
          <p className="text-sm text-slate-500 mt-1">Verwalten und vergleichen Sie Elektrifizierungsszenarien</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Szenario erstellen
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : scenarioList.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-slate-500">Keine Szenarien vorhanden. Erstellen Sie ein neues Szenario.</p>
            <Button onClick={() => setShowCreateDialog(true)} className="mt-4">
              <Plus className="h-4 w-4 mr-2" />
              Erstes Szenario erstellen
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {scenarioList.map((scenario: Scenario & { run_count?: number; last_run_status?: string }) => (
            <Card key={scenario.id} className="hover:shadow-md transition-shadow">
              <CardContent className="py-4 px-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-900">{scenario.name}</h3>
                      <Badge variant={typeColors[scenario.type] || 'default'}>
                        {getScenarioTypeLabel(scenario.type)}
                      </Badge>
                      {scenario.last_run_status === 'completed' && (
                        <Badge variant="success">Berechnet</Badge>
                      )}
                    </div>
                    <div className="flex gap-4 mt-1.5 text-xs text-slate-500">
                      <span>⚡ {scenario.electricity_price} €/kWh</span>
                      <span>🔋 {scenario.charging_power_kw} kW Ladeleistung</span>
                      <span>🌱 {scenario.grid_emission_factor} kg CO₂/kWh</span>
                      <span>Elektrifizierung: {scenario.electrification_pct}%</span>
                    </div>
                    {scenario.notes && (
                      <p className="text-xs text-slate-400 mt-1">{scenario.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-4">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleRun(scenario.id)}
                      disabled={runSimulation.isPending}
                      className="flex items-center gap-1"
                    >
                      <Play className="h-3.5 w-3.5" />
                      Berechnen
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => duplicateScenario.mutateAsync(scenario.id)}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(scenario.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Neues Szenario erstellen</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={newScenario.name} onChange={e => setNewScenario(p => ({...p, name: e.target.value}))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Typ</Label>
                <Select value={newScenario.type} onValueChange={(v) => setNewScenario(p => ({...p, type: v as ScenarioType}))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.values(ScenarioType).map(t => <SelectItem key={t} value={t}>{getScenarioTypeLabel(t)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Strompreis (€/kWh)</Label>
                <Input type="number" step="0.01" value={newScenario.electricity_price} onChange={e => setNewScenario(p => ({...p, electricity_price: parseFloat(e.target.value)}))} />
              </div>
              <div className="space-y-1">
                <Label>Dieselpreis (€/L)</Label>
                <Input type="number" step="0.01" value={newScenario.diesel_price ?? 1.75} onChange={e => setNewScenario(p => ({...p, diesel_price: parseFloat(e.target.value)}))} />
              </div>
              <div className="space-y-1">
                <Label>Ladeleistung (kW)</Label>
                <Input type="number" value={newScenario.charging_power_kw} onChange={e => setNewScenario(p => ({...p, charging_power_kw: parseFloat(e.target.value)}))} />
              </div>
              <div className="space-y-1">
                <Label>CO₂-Faktor (kg/kWh)</Label>
                <Input type="number" step="0.001" value={newScenario.grid_emission_factor} onChange={e => setNewScenario(p => ({...p, grid_emission_factor: parseFloat(e.target.value)}))} />
              </div>
              <div className="space-y-1">
                <Label>Elektrifizierung (%)</Label>
                <Input type="number" min="1" max="100" value={newScenario.electrification_pct} onChange={e => setNewScenario(p => ({...p, electrification_pct: parseFloat(e.target.value)}))} />
              </div>
            </div>
            <div className="flex items-center justify-between py-1">
              <Label>Öffentliches Laden erlauben</Label>
              <Switch checked={!!newScenario.allow_public_charging} onCheckedChange={(v) => setNewScenario(p => ({...p, allow_public_charging: v}))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Abbrechen</Button>
            <Button onClick={handleCreate} disabled={createScenario.isPending}>
              {createScenario.isPending ? 'Wird erstellt...' : 'Szenario erstellen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
