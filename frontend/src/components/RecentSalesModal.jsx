import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Ban, Clock3, Loader2, ReceiptText, X } from 'lucide-react';
import { saleService } from '../services/saleService.js';
import { formatCurrency } from '../utils/formatCurrency.js';
import { PAYMENT_METHOD_LABELS } from '../utils/quoteCalculations.js';
import { socket } from '../config/socket.js';

const getArrayData = (response) => Array.isArray(response?.data) ? response.data : [];

const stateStyles = {
  confirmada: 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100',
  cotizada: 'border-sky-300/25 bg-sky-400/10 text-sky-100',
  anulada: 'border-red-300/25 bg-red-400/10 text-red-100'
};

const stateLabels = {
  confirmada: 'Confirmada',
  cotizada: 'Cotizada',
  anulada: 'Anulada'
};

const getSaleTotal = (sale) => Number(sale.totalVenta ?? sale.total ?? sale.totalCotizacion ?? 0);

export default function RecentSalesModal({ open, onClose, onChanged }) {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);

  const recentSales = useMemo(() => sales.slice(0, 40), [sales]);

  const loadSales = async () => {
    setLoading(true);
    try {
      const response = await saleService.getToday({ limit: 40 });
      setSales(getArrayData(response));
    } catch (err) {
      toast.error(err.message || 'No se pudieron cargar las ventas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) loadSales();
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const cancelSale = async (sale) => {
    const confirmed = window.confirm(`¿Anular venta #${sale.id}? Esta acción devolverá stock si la venta estaba confirmada.`);
    if (!confirmed) return;

    const toastId = toast.loading('Anulando venta...');
    setCancellingId(sale.id);
    try {
      await saleService.cancel(sale.id, socket.id || null);
      toast.success('Venta anulada correctamente', { id: toastId });
      await loadSales();
      await onChanged?.();
    } catch (err) {
      toast.error(err.message || 'No se pudo anular la venta', { id: toastId });
    } finally {
      setCancellingId(null);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-xl">
      <div className="relative flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[#111418]/95 shadow-soft">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Caja</p>
            <div className="mt-1 flex items-center gap-2">
              <ReceiptText size={22} className="text-sky-100" />
              <h2 className="font-display text-2xl font-semibold text-white">Ventas recientes</h2>
            </div>
          </div>
          <button className="icon-button h-10 w-10 shrink-0" type="button" onClick={onClose} title="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          {loading && (
            <div className="flex min-h-[18rem] items-center justify-center gap-3 text-zinc-400">
              <Loader2 size={20} className="animate-spin" />
              Cargando ventas...
            </div>
          )}

          {!loading && recentSales.length === 0 && (
            <div className="rounded-[1.5rem] border border-dashed border-white/10 p-8 text-center text-zinc-500">
              Aun no hay ventas registradas.
            </div>
          )}

          {!loading && recentSales.length > 0 && (
            <div className="grid gap-3">
              {recentSales.map((sale) => {
                const status = String(sale.estado || 'cotizada').toLowerCase();
                const details = Array.isArray(sale.detalles) ? sale.detalles : [];
                const canCancel = status !== 'anulada';

                return (
                  <article key={sale.id} className="rounded-[1.35rem] border border-white/10 bg-white/[0.045] p-4 shadow-insetSoft">
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <strong className="text-lg text-white">Venta #{sale.id}</strong>
                          <span className={`rounded-full border px-3 py-1 text-xs font-bold ${stateStyles[status] || stateStyles.cotizada}`}>
                            {stateLabels[status] || status}
                          </span>
                          {sale.metodo_pago && (
                            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-semibold text-zinc-300">
                              {PAYMENT_METHOD_LABELS[sale.metodo_pago] || sale.metodo_pago}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                            <Clock3 size={13} />
                            {new Date(sale.fecha || sale.createdAt || Date.now()).toLocaleString('es-CL')}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-zinc-400">
                          {sale.cliente?.nombre || 'Cliente sin nombre'} {sale.cliente?.telefono ? `- ${sale.cliente.telefono}` : ''}
                        </p>

                        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                          {details.slice(0, 6).map((detail) => (
                            <div key={detail.id} className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                              <p className="line-clamp-2 text-sm font-semibold text-white">{detail.nombre_producto}</p>
                              <p className="mt-1 text-xs text-zinc-500">
                                {detail.cantidad} u. · {formatCurrency(detail.precio_unitario)}
                                {Number(detail.descuento_aplicado) > 0 ? ` · ${detail.descuento_aplicado}% desc.` : ''}
                              </p>
                            </div>
                          ))}
                          {details.length > 6 && (
                            <div className="flex items-center rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-400">
                              +{details.length - 6} productos mas
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 lg:min-w-48 lg:items-end">
                        <div className="rounded-[1.2rem] border border-white/10 bg-black/25 px-4 py-3 text-right">
                          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Total</p>
                          <p className="mt-1 font-display text-2xl font-semibold text-sky-100">{formatCurrency(getSaleTotal(sale))}</p>
                        </div>
                        <button
                          className="ghost-button w-full border-red-300/20 text-red-100 hover:border-red-200/40 lg:w-auto"
                          type="button"
                          disabled={!canCancel || cancellingId === sale.id}
                          onClick={() => cancelSale(sale)}
                        >
                          {cancellingId === sale.id ? <Loader2 size={17} className="animate-spin" /> : <Ban size={17} />}
                          {canCancel ? 'Anular' : 'Anulada'}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
