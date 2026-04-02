import { useCallback, useState } from 'react';
import { Upload, File, X, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface FileDropzoneProps {
  onFileSelect: (file: File) => void;
  accept?: string[];
  maxSizeMB?: number;
  label?: string;
  hint?: string;
  disabled?: boolean;
  selectedFile?: File | null;
  onClear?: () => void;
  className?: string;
}

const DEFAULT_ACCEPT = ['.csv', '.xlsx', '.xls'];

export default function FileDropzone({
  onFileSelect,
  accept = DEFAULT_ACCEPT,
  maxSizeMB = 50,
  label = 'Datei hier ablegen oder klicken zum Auswählen',
  hint,
  disabled = false,
  selectedFile,
  onClear,
  className,
}: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateFile = (file: File): string | null => {
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!accept.includes(extension)) {
      return `Nicht unterstütztes Format. Erlaubt: ${accept.join(', ')}`;
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      return `Datei zu groß. Maximal ${maxSizeMB} MB erlaubt.`;
    }
    return null;
  };

  const handleFile = useCallback((file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    onFileSelect(file);
  }, [onFileSelect, accept, maxSizeMB]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [disabled, handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // reset input so same file can be re-selected
    e.target.value = '';
  }, [handleFile]);

  if (selectedFile) {
    return (
      <div className={cn('border border-slate-200 rounded-xl p-4 bg-slate-50', className)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <File className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-800">{selectedFile.name}</p>
              <p className="text-xs text-slate-400">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
          </div>
          {onClear && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="text-slate-400 hover:text-slate-600 h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          'relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200',
          isDragging
            ? 'border-blue-400 bg-blue-50'
            : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white',
          disabled && 'opacity-50 cursor-not-allowed',
          !disabled && 'cursor-pointer'
        )}
      >
        <input
          type="file"
          accept={accept.join(',')}
          onChange={handleInputChange}
          disabled={disabled}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        />

        <div className="flex flex-col items-center gap-3">
          <div className={cn(
            'p-3 rounded-full transition-colors',
            isDragging ? 'bg-blue-100' : 'bg-slate-100'
          )}>
            <Upload className={cn(
              'h-6 w-6 transition-colors',
              isDragging ? 'text-blue-600' : 'text-slate-400'
            )} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700">{label}</p>
            {hint && (
              <p className="text-xs text-slate-400 mt-1">{hint}</p>
            )}
            <p className="text-xs text-slate-400 mt-1">
              {accept.join(', ')} · Max. {maxSizeMB} MB
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
