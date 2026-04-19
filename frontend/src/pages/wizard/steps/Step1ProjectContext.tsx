import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { useProjectStore } from '@/store/projectStore';
import { useCreateProject } from '@/lib/api';
import { projectSchema, ProjectFormData } from '@/lib/validations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GERMANY_INDUSTRIES, FLEET_TYPES, EUROPEAN_COUNTRIES } from '@/lib/utils';
import { ChargingOption } from '@shared/types';

export default function Step1ProjectContext() {
  const { wizard, updateWizardStep1, setWizardStep, setWizardProjectId, setActiveProject, setWizardModule } = useProjectStore();
  const navigate = useNavigate();
  const createProject = useCreateProject();

  const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: wizard.step1,
  });

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
    try {
      const project = await createProject.mutateAsync({
        ...mergedData,
        wizard_module: wizard.wizardModule,
      });
      setWizardProjectId(project.id);
      setActiveProject(project);
    } catch {
      // Backend nicht verfügbar – mit lokalem ID arbeiten
      setWizardProjectId(`local_${Date.now()}`);
    }
    setWizardStep(2);
  };

  const onSubmit = (data: ProjectFormData) => advanceToStep2(data);

  const onValidationError = () => {
    advanceToStep2(watch() as Partial<ProjectFormData>);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit, onValidationError)}>
      <div className="p-6 border-b border-slate-100">
        <h2 className="text-lg font-normal text-[#001141]">Projektkontext</h2>
      </div>

      <div className="p-6 space-y-5">
        {/* Project name */}
        <div className="space-y-2">
          <Label htmlFor="name">Projektname *</Label>
          <Input
            id="name"
            {...register('name')}
            placeholder="z.B. Lieferwagen Depot Nord"
          />
          {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
        </div>

        {/* Two columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Land *</Label>
            <Controller
              name="country"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger>
                    <SelectValue placeholder="Land auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {EUROPEAN_COUNTRIES.map(c => (
                      <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-2">
            <Label>Währung *</Label>
            <Controller
              name="currency"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger>
                    <SelectValue placeholder="Währung" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EUR">EUR – Euro</SelectItem>
                    <SelectItem value="CHF">CHF – Schweizer Franken</SelectItem>
                    <SelectItem value="GBP">GBP – Britisches Pfund</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-2">
            <Label>Flottentyp *</Label>
            <Controller
              name="fleet_type"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger>
                    <SelectValue placeholder="Flottentyp auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {FLEET_TYPES.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.fleet_type && <p className="text-xs text-red-500">{errors.fleet_type.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Branche *</Label>
            <Controller
              name="industry"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger>
                    <SelectValue placeholder="Branche auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {GERMANY_INDUSTRIES.map(i => (
                      <SelectItem key={i} value={i}>{i}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
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
          disabled={createProject.isPending}
        >
          {createProject.isPending ? 'Wird gespeichert...' : 'Weiter zu Flotte →'}
        </Button>
      </div>
    </form>
  );
}
