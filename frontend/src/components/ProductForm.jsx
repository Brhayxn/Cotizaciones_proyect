import { useEffect, useState } from 'react';
import { Save, X } from 'lucide-react';

const initialState = {
  nombre: '',
  precio: '',
  Categoria_id: '',
  activo: true
};

export default function ProductForm({ product, categories, onSubmit, onCancel }) {
  const [form, setForm] = useState(initialState);

  useEffect(() => {
    if (product) {
      setForm({
        nombre: product.nombre || '',
        precio: product.precio || '',
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
      Categoria_id: form.Categoria_id ? Number(form.Categoria_id) : null
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="field-label">
          Nombre
          <input className="field-input" name="nombre" value={form.nombre} onChange={handleChange} required />
        </label>
        <label className="field-label">
          Precio
          <input className="field-input" name="precio" type="number" min="1" value={form.precio} onChange={handleChange} required />
        </label>
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
      <div className="flex flex-wrap gap-2">
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
