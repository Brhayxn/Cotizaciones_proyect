import { useEffect, useState } from 'react';
import { Save, X } from 'lucide-react';

const initialState = { nombre: '', telefono: '' };

export default function ClientForm({ client, onSubmit, onCancel }) {
  const [form, setForm] = useState(initialState);

  useEffect(() => {
    setForm(client ? { nombre: client.nombre || '', telefono: client.telefono || '' } : initialState);
  }, [client]);

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
      <label className="field-label">
        Nombre
        <input className="field-input" value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} required />
      </label>
      <label className="field-label">
        Teléfono
        <input className="field-input" value={form.telefono} onChange={(event) => setForm({ ...form, telefono: event.target.value })} />
      </label>
      <div className="flex items-end gap-2">
        <button className="soft-button h-12" type="submit">
          <Save size={18} />
        </button>
        <button className="ghost-button h-12" type="button" onClick={onCancel}>
          <X size={18} />
        </button>
      </div>
    </form>
  );
}
