import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Upload, CheckCircle, AlertCircle, ArrowRight, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { previewFile, uploadRoutes } from '@/lib/api';

const REQUIRED_FIELDS = ['distance_km'];
const OPTIONAL_FIELDS = [
  { key: 'route_id', label: 'Tour-ID' },
  { key: 'date', label: 'Datum' },
  { key: 'start_time', label: 'Startzeit' },
  { key: 'end_time', label: 'Endzeit' },
  { key: 'stops', label: 'Stopps' },
  { key: 'dwell_time_min', label: 'Standzeit (min)' },
  { key: 'avg_speed_kmh', label: 'Ø-Geschwindigkeit (km/h)' },
  { key: 'payload_kg', label: 'Nutzlast (kg)' },
  { key: 'vehicle_id', label: 'Fahrzeug-ID' },
  { key: 'depot_id', label: 'Depot-ID' },
  { key: 'outside_temperature_c', label: 'Außentemperatur (°C)' },
  { key: 'elevation_gain_m', label: 'Höhenmeter (m)' },
];

type Step = 'select' | 'map' | 'preview' | 'done';

export default function TourUpload() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('select');
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previewData, setPreviewData] = useState<{ headers: string[]; rows: Record<string, string>[]; total_rows: number } | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ imported: number; errors: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);
    setIsLoading(true);
    try {
      const preview = await previewFile(selectedFile);
      setPreviewData(preview);

      // Auto-detect common column names
      const autoMapping: Record<string, string> = {};
      const headers = preview.headers;
      const normalize = (s: string) => s.toLowerCase().replace(/[\s_-]/g, '');

      const mappings: { field: string; candidates: string[] }[] = [
        { field: 'distance_km', candidates: ['distancekm', 'distanz', 'km', 'strecke', 'distance'] },
        { field: 'route_id', candidates: ['routeid', 'tourid', 'id', 'routenr', 'tourne'] },
        { field: 'date', candidates: ['datum', 'date', 'tag'] },
        { field: 'stops', candidates: ['stopps', 'stops', 'haltestellen'] },
        { field: 'dwell_time_min', candidates: ['standzeitmin', 'standzeit', 'dwell', 'dwelltime'] },
        { field: 'avg_speed_kmh', candidates: ['geschwindigkeit', 'speed', 'avgspeed'] },
        { field: 'payload_kg', candidates: ['nutzlastkg', 'nutzlast', 'payload', 'zuladung'] },
        { field: 'vehicle_id', candidates: ['fahrzeugid', 'vehicleid', 'kennzeichen', 'fahrzeug'] },
      ];

      for (const { field, candidates } of mappings) {
        const match = headers.find(h => candidates.includes(normalize(h)));
        if (match) autoMapping[field] = match;
      }

      setMapping(autoMapping);
      setStep('map');
    } catch (e) {
      setError('Fehler beim Laden der Datei. Bitte überprüfen Sie das Format.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFileChange(dropped);
  }, []);

  const handleImport = async () => {
    if (!file || !projectId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await uploadRoutes(file, projectId, mapping);
      setResult(res);
      setStep('done');
    } catch (e) {
      setError('Fehler beim Importieren. Bitte überprüfen Sie die Datei.');
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setStep('select');
    setFile(null);
    setPreviewData(null);
    setMapping({});
    setResult(null);
    setError(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Tour-Daten hochladen</h1>
        <p className="text-sm text-slate-500 mt-1">Importieren Sie CSV- oder XLSX-Dateien mit Ihren Tourdaten</p>
      </div>

      {/* Progress steps */}
      <div className="flex items-center gap-2 text-sm">
        {(['select', 'map', 'preview', 'done'] as Step[]).map((s, i) => {
          const labels = ['Datei wählen', 'Spalten zuordnen', 'Vorschau', 'Fertig'];
          const isActive = s === step;
          const isDone = ['select', 'map', 'preview', 'done'].indexOf(s) < ['select', 'map', 'preview', 'done'].indexOf(step);
          return (
            <div key={s} className="flex items-center gap-2">
              <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                isDone ? 'bg-green-500 text-white' : isActive ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-400'
              }`}>
                {isDone ? '✓' : i + 1}
              </div>
              <span className={isActive ? 'text-blue-600 font-medium' : 'text-slate-400'}>{labels[i]}</span>
              {i < 3 && <ArrowRight className="h-3.5 w-3.5 text-slate-300" />}
            </div>
          );
        })}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Fehler</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Step 1: File select */}
      {step === 'select' && (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
            isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-slate-400'
          }`}
        >
          <Upload className="h-10 w-10 text-slate-400 mx-auto mb-3" />
          <h3 className="font-semibold text-slate-700 mb-1">CSV oder XLSX-Datei hochladen</h3>
          <p className="text-sm text-slate-500 mb-4">Datei hier ablegen oder</p>
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={e => { if (e.target.files?.[0]) handleFileChange(e.target.files[0]); }}
            />
            <Button type="button" variant="outline" disabled={isLoading}>
              {isLoading ? 'Wird geladen...' : 'Datei auswählen'}
            </Button>
          </label>
          <p className="text-xs text-slate-400 mt-3">
            Maximal 50 MB · CSV (UTF-8) oder XLSX
          </p>
        </div>
      )}

      {/* Step 2: Column mapping */}
      {step === 'map' && previewData && (
        <div className="bg-white border rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-900">Spaltenzuordnung</h3>
              <p className="text-sm text-slate-500">Datei: {file?.name} · {previewData.total_rows} Zeilen erkannt</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Distanz (km) *</label>
              <Select
                value={mapping['distance_km'] || ''}
                onValueChange={(v) => setMapping(p => ({ ...p, distance_km: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Spalte auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  {previewData.headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {OPTIONAL_FIELDS.map(f => (
              <div key={f.key} className="space-y-1">
                <label className="text-xs font-medium text-slate-600">{f.label}</label>
                <Select
                  value={mapping[f.key] || '__none__'}
                  onValueChange={(v) => setMapping(p => {
                    if (v === '__none__') { const n = {...p}; delete n[f.key]; return n; }
                    return { ...p, [f.key]: v };
                  })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Nicht zuordnen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">– Nicht zuordnen –</SelectItem>
                    {previewData.headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>

          {/* Preview table */}
          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-2">Datenvorschau (erste 5 Zeilen)</h4>
            <div className="overflow-x-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    {previewData.headers.slice(0, 8).map(h => (
                      <TableHead key={h} className="text-xs whitespace-nowrap">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.rows.slice(0, 5).map((row, i) => (
                    <TableRow key={i}>
                      {previewData.headers.slice(0, 8).map(h => (
                        <TableCell key={h} className="text-xs">{row[h]}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={reset}>← Andere Datei</Button>
            <Button onClick={handleImport} disabled={!mapping['distance_km'] || isLoading}>
              {isLoading ? 'Wird importiert...' : `${previewData.total_rows} Zeilen importieren →`}
            </Button>
          </div>
        </div>
      )}

      {/* Step: Done */}
      {step === 'done' && result && (
        <div className="bg-white border rounded-xl p-8 text-center space-y-4">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
          <div>
            <h3 className="text-lg font-bold text-slate-900">Import erfolgreich!</h3>
            <p className="text-slate-500 mt-1">{result.imported} Touren erfolgreich importiert.</p>
          </div>

          {result.errors.length > 0 && (
            <Alert variant="warning">
              <AlertTitle>{result.errors.length} Warnungen</AlertTitle>
              <AlertDescription>
                <ul className="text-xs space-y-0.5 mt-1">
                  {result.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                  {result.errors.length > 5 && <li>... und {result.errors.length - 5} weitere</li>}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={reset} className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Weitere Datei hochladen
            </Button>
            <Button onClick={() => navigate(`/projekte/${projectId}/szenarien`)}>
              Weiter zu Szenarien →
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
