import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { ChevronDown, ChevronUp, Edit3, History, Phone, Search, Trash2, UserPlus } from 'lucide-react';
import GlassCard from '../components/GlassCard.jsx';
import ClientForm from '../components/ClientForm.jsx';
import { clientService } from '../services/clientService.js';
import { formatCurrency } from '../utils/formatCurrency.js';

const getArrayData = (response) => Array.isArray(response?.data) ? response.data : [];

export default function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [openHistoryId, setOpenHistoryId] = useState(null);
  const [quotesByClient, setQuotesByClient] = useState({});
  const [historyLoadingId, setHistoryLoadingId] = useState(null);

  const loadClients = async () => {
    setLoading(true);
    try {
      const response = await clientService.getAll();
      setClients(getArrayData(response));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClients();
  }, []);

  const filteredClients = useMemo(
    () => clients.filter((client) => `${client.nombre || ''} ${client.telefono || ''}`.toLowerCase().includes(search.toLowerCase())),
    [clients, search]
  );

  const saveClient = async (payload) => {
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
    try {
      await clientService.remove(client.id);
      toast.success('Cliente eliminado');
      await loadClients();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const toggleHistory = async (client) => {
    if (openHistoryId === client.id) {
      setOpenHistoryId(null);
      return;
    }

    setOpenHistoryId(client.id);
    if (quotesByClient[client.id]) return;

    setHistoryLoadingId(client.id);
    try {
      const response = await clientService.getQuotes(client.id);
      setQuotesByClient((current) => ({ ...current, [client.id]: response.data }));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setHistoryLoadingId(null);
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
          {filteredClients.map((client) => {
            const quotes = quotesByClient[client.id] || [];
            const isHistoryOpen = openHistoryId === client.id;
            const isLoadingHistory = historyLoadingId === client.id;

            return (
              <GlassCard key={client.id} className="client-card self-start">
                <div className="client-card-body flex min-h-36 flex-col justify-between gap-5">
                  <div>
                    <h2 className="client-name text-xl font-semibold">{client.nombre}</h2>
                    <p className="client-phone mt-3 flex items-center gap-2 text-zinc-400">
                      <Phone size={17} /> {client.telefono || 'Sin teléfono'}
                    </p>
                  </div>

                  <div className="client-actions grid gap-2 sm:grid-cols-2">
                    <button className="ghost-button w-full" onClick={() => toggleHistory(client)}>
                      <History size={18} /> Historial
                      {isHistoryOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    <button className="soft-button w-full" onClick={() => { setEditing(client); setShowForm(true); }}>
                      <Edit3 size={18} /> Editar
                    </button>
                    <button className="ghost-button w-full sm:col-span-2" onClick={() => removeClient(client)}>
                      <Trash2 size={18} /> Eliminar
                    </button>
                  </div>

                  {isHistoryOpen && (
                    <div className="client-history space-y-2 rounded-[1.4rem] border border-white/10 bg-black/20 p-3 shadow-insetSoft">
                      {isLoadingHistory && (
                        <p className="text-sm text-zinc-400">Cargando historial...</p>
                      )}

                      {!isLoadingHistory && quotes.length === 0 && (
                        <p className="text-sm text-zinc-500">Este cliente aún no tiene ventas o cotizaciones guardadas.</p>
                      )}

                      {quotes.map((quote) => (
                        <article key={quote.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold">Venta #{quote.id}</p>
                              <p className="mt-1 text-xs text-zinc-500">
                                {new Date(quote.fecha || quote.createdAt).toLocaleDateString('es-CL')}
                              </p>
                            </div>
                            <div className="text-right">
                              <strong className="text-sky-100">{formatCurrency(quote.totalVenta ?? quote.totalCotizacion)}</strong>
                              <p className="mt-1 text-xs capitalize text-zinc-500">{quote.estado || 'cotizada'}</p>
                            </div>
                          </div>
                          <p className="mt-2 text-xs text-zinc-400">
                            {(quote.detalles || []).length} producto{(quote.detalles || []).length === 1 ? '' : 's'}
                          </p>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
