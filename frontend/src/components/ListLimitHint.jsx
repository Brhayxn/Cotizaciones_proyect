import { Search } from 'lucide-react';

export default function ListLimitHint({ meta }) {
  if (!meta?.hasMore) return null;

  return (
    <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-zinc-400">
      <Search size={15} className="shrink-0 text-sky-100" />
      <span>Hay {meta.total} coincidencias. Refina la busqueda para encontrar mas resultados.</span>
    </div>
  );
}
