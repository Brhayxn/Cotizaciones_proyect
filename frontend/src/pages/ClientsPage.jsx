import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Edit3, History, Phone, Search, Trash2, UserPlus } from 'lucide-react';
import GlassCard from '../components/GlassCard.jsx';
import ClientForm from '../components/ClientForm.jsx';
import ListLimitHint from '../components/ListLimitHint.jsx';
import RecentSalesModal from '../components/RecentSalesModal.jsx';
import { clientService } from '../services/clientService.js';
import { useDebouncedValue } from '../hooks/useDebouncedValue.js';
import { formatCurrency } from '../utils/formatCurrency.js';

const getArrayData = (response) => Array.isArray(response?.data) ? response.data : [];

export default function ClientsPage() {
  // Administra clientes y permite abrir su historial sin salir de la vista.
  const [clients, setClients] = useState([]);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [debtFilter, setDebtFilter] = useState('todos');
  const [loading, setLoading] = useState(true);
  const [salesClient, setSalesClient] = useState(null);
  const [meta, setMeta] = useState(null);
  const requestId = useRef(0);
  const debouncedSearch = useDebouncedValue(search);

  const loadClients = async () => {
    // Usa debounce + requestId para que búsquedas rápidas no mezclen resultados.
    const currentRequest = ++requestId.current;
    setLoading(true);
    try {
      const params = {};
      if (debouncedSearch.trim()) params.q = debouncedSearch.trim();
      if (debtFilter === 'con') params.con_deuda = true;
      if (debtFilter === 'sin') params.con_deuda = false;
      const response = await clientService.getAll(params);
      if (currentRequest !== requestId.current) return;
      setClients(getArrayData(response));
      setMeta(response.meta || null);
    } catch (err) {
      if (currentRequest === requestId.current) toast.error(err.message);
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  };

  useEffect(() => {
    loadClients();
  }, [debouncedSearch, debtFilter]);

  const saveClient = async (payload) => {
    // Reutiliza el mismo formulario para alta y edición.
    try {
      if (editing) {
        await clientService.update(editing.id, payload);
        toast.success('Cliente actualizado');
      } else {
        await clientService.create(payload);
        toast.success('Cliente creado');
      }
      setEditing(null);
      setShowForm(false);
      await loadClients();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const removeClient = async (client) => {
    // La eliminación depende de reglas del backend si el cliente tiene ventas asociadas.
    try {
      await clientService.remove(client.id);
      toast.success('Cliente eliminado');
      await loadClients();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="clients-view space-y-5">
      <GlassCard className="management-toolbar flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="field-label flex-1">
          Buscar cliente
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
            <input className="field-input with-icon" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre o teléfono" />
          </div>
        </label>
        <label className="field-label w-full sm:w-48">
          Deuda
          <select className="field-input" value={debtFilter} onChange={(event) => setDebtFilter(event.target.value)}>
            <option value="todos">Todos</option>
            <option value="con">Con deuda</option>
            <option value="sin">Sin deuda</option>
          </select>
        </label>
        <button className="management-primary-action soft-button h-12" onClick={() => { setEditing(null); setShowForm(true); }}>
          <UserPlus size={18} /> Cliente
        </button>
      </GlassCard>

      {showForm && (
        <GlassCard className="management-form-card">
          <ClientForm client={editing} onSubmit={saveClient} onCancel={() => { setShowForm(false); setEditing(null); }} />
        </GlassCard>
      )}

      {loading ? <GlassCard>Cargando clientes...</GlassCard> : (
        <div className="clients-grid content-grid grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((client) => (
            <GlassCard key={client.id} className="client-card self-start">
              <div className="client-card-body flex min-h-36 flex-col justify-between gap-5">
                <div>
                  <h2 className="client-name text-xl font-semibold">{client.nombre}</h2>
                  <p className="client-phone mt-3 flex items-center gap-2 text-zinc-400">
                    <Phone size={17} /> {client.telefono || 'Sin teléfono'}
                  </p>
                  {Number(client.deuda_total || 0) > 0 && (
                    <p className="mt-3 inline-flex rounded-full border border-amber-200/20 bg-amber-300/10 px-3 py-1 text-xs font-bold text-amber-100">
                      Debe {formatCurrency(client.deuda_total)} en {client.ventas_pendientes} venta{client.ventas_pendientes === 1 ? '' : 's'}
                    </p>
                  )}
                </div>

                <div className="client-actions grid gap-2 sm:grid-cols-2">
                  <button className="ghost-button w-full" onClick={() => setSalesClient(client)}>
                    <History size={18} /> Ventas
                  </button>
                  <button className="soft-button w-full" onClick={() => { setEditing(client); setShowForm(true); }}>
                    <Edit3 size={18} /> Editar
                  </button>
                  <button className="ghost-button w-full sm:col-span-2" onClick={() => removeClient(client)}>
                    <Trash2 size={18} /> Eliminar
                  </button>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
      {!loading && <ListLimitHint meta={meta} />}
      <RecentSalesModal
        open={Boolean(salesClient)}
        onClose={() => setSalesClient(null)}
        loadSales={() => clientService.getQuotes(salesClient.id)}
        onChanged={loadClients}
        title={salesClient ? `Ventas de ${salesClient.nombre}` : 'Ventas del cliente'}
        subtitle="Cliente"
        description={salesClient?.telefono ? `Teléfono ${salesClient.telefono}` : 'Sin teléfono registrado'}
      />
    </div>
  );
}
