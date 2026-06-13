import { Edit3, Plus, Power } from 'lucide-react';
import { formatCurrency } from '../utils/formatCurrency.js';
import GlassCard from './GlassCard.jsx';

export default function ProductCard({ product, onAdd, onEdit, onToggle, compact = false }) {
  return (
    <GlassCard className={`group ${compact ? 'p-2.5' : 'p-5'}`}>
      <div className={`flex flex-col justify-between ${compact ? 'min-h-[8.2rem] gap-2' : 'min-h-28 gap-4'}`}>
        <div>
          <div className={`${compact ? 'mb-1.5' : 'mb-3'} flex items-start justify-between gap-3`}>
            <span className="rounded-full border border-white/10 bg-white/10 px-2.5 py-0.5 text-[0.72rem] text-zinc-300">
              {product.categoria?.nombre || 'Sin categoría'}
            </span>
            <span className={`h-2 w-2 rounded-full ${product.activo ? 'bg-sky-300 shadow-glow' : 'bg-zinc-600'}`} />
          </div>
          <h3 className={`${compact ? 'line-clamp-2 text-[0.95rem]' : 'text-lg'} font-semibold leading-snug text-white`}>{product.nombre}</h3>
          <p className={`${compact ? 'mt-0.5 text-[1.45rem]' : 'mt-2 text-2xl'} font-display font-semibold text-sky-100`}>
            {formatCurrency(product.precio)}
          </p>
        </div>
        <div className="flex gap-2">
          {onAdd && (
            <button className={`soft-button flex-1 ${compact ? 'min-h-9 py-1.5 text-sm' : ''}`} onClick={() => onAdd(product)}>
              <Plus size={16} /> Agregar
            </button>
          )}
          {onEdit && (
            <button className="icon-button" onClick={() => onEdit(product)} title="Editar producto">
              <Edit3 size={18} />
            </button>
          )}
          {onToggle && (
            <button className="icon-button" onClick={() => onToggle(product)} title="Cambiar estado">
              <Power size={18} />
            </button>
          )}
        </div>
      </div>
    </GlassCard>
  );
}
