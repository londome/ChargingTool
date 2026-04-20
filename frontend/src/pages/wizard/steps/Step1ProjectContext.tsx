import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useProjectStore } from '@/store/projectStore';
import { useCreateProject, useReichweitenProjects, useCopyRoutesToProject, useProject } from '@/lib/api';
import { projectSchema, ProjectFormData } from '@/lib/validations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GERMANY_INDUSTRIES, FLEET_TYPES, EUROPEAN_COUNTRIES } from '@/lib/utils';
import { ChargingOption } from '@shared/types';
import { RefreshCw, CheckCircle2 } from 'lucide-react';

export default function Step1ProjectContext() {
  const {
    wizard, updateWizardStep1, setWizardStep,
    setWizardProjectId, setActiveProject,
    setReuseReichweitenProjectId,
  } = useProjectStore();

  const createProject = useCreateProject();
  const copyRoutes = useCopyRoutesToProject();
  const { data: reichweitenProjects } = useReichweitenProjects();

  const isLadeprozess = wizard.wizardModule === 'ladeprozess';

  // Reuse state
  const [reuseEnabled, setReuseEnabled] = useState(false);
  const [selectedReuseId, setSelectedReuseId] = useState<string>('');

  // Fetch source project data when one is selected
  const { data: sourceProject } = useProject(selectedReuseId || undefined);

  const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: wizard.step1,
  });

  // Pre-fill all form fields from the selected source project
  useEffect(() => {
    if (reuseEnabled && sourceProject) {
      setValue('name', sourceProject.name ?? '');
      setValue('country', sourceProject.country ?? 'DE');
      setValue('currency', sourceProject.currency ?? 'EUR');
      setValue('fleet_type', sourceProject.fleet_type ?? '');
      setValue('industry', sourceProject.industry ?? '');
      setValue('depot_location', sourceProject.depot_location ?? '');
    }
  }, [reuseEnabled, sourceProject, setValue]);

  // Reset form when reuse is turned off
  useEffect(() => {
    if (!reuseEnabled) {
      setSelectedReuseId('');
    }
  }, [reuseEnabled]);

  const advanceToStep2 = async (data: Partial<ProjectFormData>) => {
    const mergedData = {
      name: data.name || 'Neues Projekt',
      country: data.country || 'DE',
      currency: data.currency || 'EUR',
      fleet_type: data.fleet_type || 'Lieferflotte',
      industry: data.industry || 'Sonstige',
      depot_location: data.depot_location || '-',
      charging_options: (data.charging_options && data.charging_options.length > 0)
        ? data.charging_options
        : [ChargingOption.DEPOT_AC],
    };
    updateWizardStep1(mergedData);

    let newProjectId: string | null = null;
    try {
      const project = await createProject.mutateAsync({
        ...mergedData,
        wizard_module: wizard.wizardModule,
      });
      newProjectId = project.id;
      setWizardProjectId(project.id);
      setActiveProject(project);
    } catch {
      const localId = `local_${Date.now()}`;
      newProjectId = localId;
      setWizardProjectId(localId);
    }

    // Reuse: copy routes and jump to Step 4 (Depot)
    if (isLadeprozess && reuseEnabled && selectedReuseId && newProjectId && !newProjectId.startsWith('local_')) {
      setReuseReichweitenProjectId(selectedReuseId);
      try {
        await copyRoutes.mutateAsync({ source_project_id: selectedReuseId, target_project_id: newProjectId });
      } catch (e) {
        console.warn('Route copy failed, continuing without reuse', e);
      }
      setWizardStep(4);
      return;
    }

    setReuseReichweitenProjectId(null);
    setWizardStep(2);
  };

  const onSubmit = (data: ProjectFormData) => advanceToStep2(data);
  const onValidationError = () => advanceToStep2(watch() as Partial<ProjectFormData>);

  const isReusing = isLadeprozess && reuseEnabled && !!selectedReuseId;
  const isPending = createProject.isPending || copyRoutes.isPending;

  return (
    <form onSubmit={handleSubmit(onSubmit, onValidationError)}>
      <div className="p-6 border-b border-slate-100">
        <h2 className="text-lg font-normal text-[#001141]">Projektkontext</h2>
      </div>

      <div className="p-6 space-y-5">

        {/* ── Reuse question — first, only for Ladeprozess ── */}
        {isLadeprozess && (
          <div className={`rounded border p-4 space-y-3 transition-colors ${reuseEnabled ? 'border-[#0079C0] bg-[#f0f8ff]' : 'border-slate-200'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-[#0079C0] shrink-0" />
                <div>
                  <p className="text-sm font-medium text-[#001141]">Reichweiten-Analyse wiederverwenden</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Übernimm Routen und Flottendaten aus einer abgeschlossenen Reichweiten-Simulation.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReuseEnabled(v => !v)}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${reuseEnabled ? 'bg-[#0079C0]' : 'bg-slate-200'}`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow ${reuseEnabled ? 'translate-x-[18px]' : 'translate-x-[2px]'}`} />
              </button>
            </div>

            {reuseEnabled && (
              !reichweitenProjects || reichweitenProjects.length === 0 ? (
                <p className="text-xs text-amber-700 bg-amber-50 rounded px-3 py-2 border border-amber-200">
                  Kein abgeschlossenes Reichweiten-Projekt gefunden. Bitte zuerst Modul 1 durchführen.
                </p>
              ) : (
                <div className="space-y-2">
                  <Label className="text-xs">Projekt auswählen</Label>
                  <Select value={selectedReuseId} onValueChange={setSelectedReuseId}>
                    <SelectTrigger className="h-9 text-sm bg-white">
                      <SelectValue placeholder="Reichweiten-Projekt auswählen…" />
                    </SelectTrigger>
                    <SelectContent>
                      {reichweitenProjects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          <span className="font-medium">{p.name}</span>
                          <span className="text-slate-400 ml-1">— {p.depot_location}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedReuseId && sourceProject && (
                    <div className="flex items-center gap-1.5 text-xs text-[#043F2E] bg-[#f4fbf8] rounded px-2.5 py-1.5 border border-[#043F2E]/20">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      Daten aus <span className="font-medium mx-0.5">„{sourceProject.name}"</span> werden übernommen.
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        )}

        {/* ── Project name ── */}
        <div className="space-y-2">
          <Label htmlFor="name">Projektname *</Label>
          <Input
            id="name"
            {...register('name')}
            placeholder="z.B. Lieferwagen Depot Nord"
          />
          {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
        </div>

        {/* ── Rest of form — always visible, pre-filled when reusing ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Land *</Label>
            <Controller name="country" control={control} render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger><SelectValue placeholder="Land auswählen" /></SelectTrigger>
                <SelectContent>
                  {EUROPEAN_COUNTRIES.map(c => (
                    <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )} />
          </div>

          <div className="space-y-2">
            <Label>Währung *</Label>
            <Controller name="currency" control={control} render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger><SelectValue placeholder="Währung" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EUR">EUR – Euro</SelectItem>
                  <SelectItem value="CHF">CHF – Schweizer Franken</SelectItem>
                  <SelectItem value="GBP">GBP – Britisches Pfund</SelectItem>
                </SelectContent>
              </Select>
            )} />
          </div>

          <div className="space-y-2">
            <Label>Flottentyp *</Label>
            <Controller name="fleet_type" control={control} render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger><SelectValue placeholder="Flottentyp auswählen" /></SelectTrigger>
                <SelectContent>
                  {FLEET_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            )} />
            {errors.fleet_type && <p className="text-xs text-red-500">{errors.fleet_type.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Branche *</Label>
            <Controller name="industry" control={control} render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger><SelectValue placeholder="Branche auswählen" /></SelectTrigger>
                <SelectContent>
                  {GERMANY_INDUSTRIES.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                </SelectContent>
              </Select>
            )} />
            {errors.industry && <p className="text-xs text-red-500">{errors.industry.message}</p>}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="depot_location">Depotstandort *</Label>
          <Input
            id="depot_location"
            {...register('depot_location')}
            placeholder="z.B. Frankfurt am Main"
          />
          {errors.depot_location && <p className="text-xs text-red-500">{errors.depot_location.message}</p>}
        </div>

      </div>

      {/* Footer */}
      <div className="p-6 border-t border-slate-100 flex justify-end">
        <Button
          type="button"
          onClick={() => advanceToStep2(watch() as Partial<ProjectFormData>)}
          disabled={isPending || (isLadeprozess && reuseEnabled && !selectedReuseId)}
        >
          {isPending
            ? 'Wird gespeichert…'
            : isReusing
            ? 'Weiter zu Depot →'
            : 'Weiter zum Mobilitätsprofil →'}
        </Button>
      </div>
    </form>
  );
}
