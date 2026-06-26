import { useEffect, useState } from 'react';
import { BadgePercent, Save, X } from 'lucide-react';
import { formatCurrency } from '../utils/formatCurrency.js';

const initialState = {
  nombre: '',
  precio: '',
  descuento_maximo: 0,
  stock: 0,
  Categoria_id: '',
  activo: true
};

export default function ProductForm({ product, categories, onSubmit, onCancel }) {
  const [form, setForm] = useState(initialState);
  const price = Math.max(0, Number(form.precio) || 0);
  const maximumDiscount = Math.min(100, Math.max(0, Number(form.descuento_maximo) || 0));
  const finalPrice = Math.round(price * ((100 - maximumDiscount) / 100));
  const maximumSaving = price - finalPrice;

  useEffect(() => {
    if (product) {
      setForm({
        nombre: product.nombre || '',
        precio: product.precio || '',
        descuento_maximo: product.descuento_maximo ?? 0,
        stock: product.stock ?? 0,
        Categoria_id: product.Categoria_id || '',
        activo: product.activo !== false
      });
    } else {
      setForm(initialState);
    }
  }, [product]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit({
      ...form,
      precio: Number(form.precio),
      descuento_maximo: Number(form.descuento_maximo) || 0,
      stock: Number(form.stock) || 0,
      Categoria_id: form.Categoria_id ? Number(form.Categoria_id) : null
    });
  };

  return (
    <form onSubmit={handleSubmit} className="product-form space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="field-label">
          Nombre
          <input className="field-input" name="nombre" value={form.nombre} onChange={handleChange} required />
        </label>
        <label className="field-label">
          Precio
          <input className="field-input" name="precio" type="number" min="1" value={form.precio} onChange={handleChange} required />
        </label>
        <label className="field-label">
          Stock
          <input className="field-input" name="stock" type="number" min="0" value={form.stock} onChange={handleChange} />
        </label>
        <label className="field-label">
          Descuento máximo %
          <input className="field-input" name="descuento_maximo" type="number" min="0" max="100" value={form.descuento_maximo} onChange={handleChange} />
        </label>
      </div>

      <div className="border-y border-white/10 py-3" aria-live="polite">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold text-zinc-300">
          <BadgePercent size={17} className="text-sky-200" />
          Precio con descuento máximo
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-zinc-500">Precio base</p>
            <p className="mt-1 font-semibold text-zinc-300">{formatCurrency(price)}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Ahorro</p>
            <p className="mt-1 font-semibold text-zinc-300">{formatCurrency(maximumSaving)}</p>
          </div>
          <div className="col-span-2 flex items-end justify-between gap-3 border-t border-white/10 pt-3">
            <p className="text-xs text-zinc-500">Precio final</p>
            <p className="font-display text-xl font-semibold text-sky-100">{formatCurrency(finalPrice)}</p>
          </div>
        </div>
      </div>

      <label className="field-label">
        Categoría
        <select className="field-input" name="Categoria_id" value={form.Categoria_id} onChange={handleChange}>
          <option value="">Sin categoría</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.nombre}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-3 text-sm text-zinc-200">
        <input className="h-5 w-5 accent-sky-300" type="checkbox" name="activo" checked={form.activo} onChange={handleChange} />
        Producto activo
      </label>
      <div className="form-actions flex flex-wrap gap-2">
        <button className="soft-button" type="submit">
          <Save size={18} /> Guardar
        </button>
        <button className="ghost-button" type="button" onClick={onCancel}>
          <X size={18} /> Cancelar
        </button>
      </div>
    </form>
  );
}
