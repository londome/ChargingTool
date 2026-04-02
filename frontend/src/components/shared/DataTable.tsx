import { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

export interface ColumnDef<T> {
  key: keyof T | string;
  header: string;
  sortable?: boolean;
  className?: string;
  headerClassName?: string;
  render?: (value: unknown, row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  searchable?: boolean;
  searchPlaceholder?: string;
  searchKeys?: (keyof T)[];
  pageSize?: number;
  className?: string;
  emptyMessage?: string;
  loading?: boolean;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string;
}

type SortDirection = 'asc' | 'desc' | null;

function getNestedValue(obj: unknown, key: string): unknown {
  return key.split('.').reduce((acc: unknown, part: string) => {
    if (acc && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
}

export default function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  searchable = false,
  searchPlaceholder = 'Suchen...',
  searchKeys = [],
  pageSize = 20,
  className,
  emptyMessage = 'Keine Daten vorhanden',
  loading = false,
  onRowClick,
  rowClassName,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDir === 'asc') setSortDir('desc');
      else if (sortDir === 'desc') { setSortKey(null); setSortDir(null); }
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(0);
  };

  const filtered = useMemo(() => {
    if (!search.trim() || searchKeys.length === 0) return data;
    const q = search.toLowerCase();
    return data.filter(row =>
      searchKeys.some(k => {
        const v = row[k];
        return v != null && String(v).toLowerCase().includes(q);
      })
    );
  }, [data, search, searchKeys]);

  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return filtered;
    return [...filtered].sort((a, b) => {
      const av = getNestedValue(a, sortKey);
      const bv = getNestedValue(b, sortKey);
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      const as = String(av).toLowerCase();
      const bs = String(bv).toLowerCase();
      if (as < bs) return sortDir === 'asc' ? -1 : 1;
      if (as > bs) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.ceil(sorted.length / pageSize);
  const paginated = sorted.slice(page * pageSize, (page + 1) * pageSize);

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortKey !== columnKey) return <ChevronsUpDown className="h-3.5 w-3.5 text-slate-300" />;
    if (sortDir === 'asc') return <ChevronUp className="h-3.5 w-3.5 text-blue-600" />;
    return <ChevronDown className="h-3.5 w-3.5 text-blue-600" />;
  };

  if (loading) {
    return (
      <div className={cn('border border-slate-200 rounded-xl overflow-hidden', className)}>
        <div className="animate-pulse">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-4 px-4 py-3 border-b border-slate-100">
              {columns.map((_, j) => (
                <div key={j} className="h-4 bg-slate-100 rounded flex-1" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {searchable && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder={searchPlaceholder}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            className="pl-9 h-9 text-sm"
          />
        </div>
      )}

      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {columns.map(col => (
                  <th
                    key={String(col.key)}
                    className={cn(
                      'px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap',
                      col.sortable && 'cursor-pointer select-none hover:bg-slate-100 transition-colors',
                      col.headerClassName
                    )}
                    onClick={col.sortable ? () => handleSort(String(col.key)) : undefined}
                  >
                    <div className="flex items-center gap-1">
                      {col.header}
                      {col.sortable && <SortIcon columnKey={String(col.key)} />}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-10 text-center text-slate-400 text-sm">
                    {search ? `Keine Ergebnisse für "${search}"` : emptyMessage}
                  </td>
                </tr>
              ) : (
                paginated.map((row, idx) => (
                  <tr
                    key={idx}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(
                      'border-b border-slate-100 last:border-0 transition-colors',
                      onRowClick && 'cursor-pointer hover:bg-slate-50',
                      rowClassName ? rowClassName(row) : ''
                    )}
                  >
                    {columns.map(col => {
                      const raw = getNestedValue(row, String(col.key));
                      return (
                        <td
                          key={String(col.key)}
                          className={cn('px-4 py-3 text-slate-700', col.className)}
                        >
                          {col.render ? col.render(raw, row) : raw != null ? String(raw) : '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>
            {sorted.length} Einträge · Seite {page + 1} von {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="h-7 w-7 p-0"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
              const pageNum = Math.min(
                Math.max(0, page - 2) + i,
                totalPages - 1
              );
              const isActive = pageNum === page;
              return (
                <Button
                  key={pageNum}
                  variant={isActive ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPage(pageNum)}
                  className={cn(
                    'h-7 w-7 p-0 text-xs',
                    isActive && 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600'
                  )}
                >
                  {pageNum + 1}
                </Button>
              );
            })}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="h-7 w-7 p-0"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
