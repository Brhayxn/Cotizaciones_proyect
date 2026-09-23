import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Ban, Clock3, Loader2, ReceiptText, Search, X } from 'lucide-react';
import { saleService } from '../services/saleService.js';
import { formatCurrency } from '../utils/formatCurrency.js';
import { PAYMENT_METHOD_LABELS } from '../utils/quoteCalculations.js';
import { socket } from '../config/socket.js';

const getArrayData = (response) => Array.isArray(response?.data) ? response.data : [];

const stateStyles = {
  // Colores por estado para identificar rápido si una venta afecta stock o no.
  confirmada: 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100',
  cotizada: 'border-sky-300/25 bg-sky-400/10 text-sky-100',
  anulada: 'border-red-300/25 bg-red-400/10 text-red-100'
};

const stateLabels = {
  confirmada: 'Confirmada',
  cotizada: 'Cotizada',
  anulada: 'Anulada'
};

const paymentStateStyles = {
  pendiente: 'border-amber-300/25 bg-amber-400/10 text-amber-100',
  parcial: 'border-cyan-300/25 bg-cyan-400/10 text-cyan-100',
  pagada: 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100'
};

const paymentStateLabels = {
  pendiente: 'Pendiente',
  parcial: 'Abonada',
  pagada: 'Pagada'
};

const getSaleTotal = (sale) => Number(sale.totalVenta ?? sale.total ?? sale.totalCotizacion ?? 0);

export default function RecentSalesModal({ open, onClose, onChanged, loadSales: loadSalesRequest, title = 'Ventas recientes', subtitle = 'Caja', description = null }) {
  // Carga y permite anular ventas recientes sin salir de la pantalla de venta.
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);
  const [paymentSaleId, setPaymentSaleId] = useState(null);
  const [paymentMode, setPaymentMode] = useState('payment');
  const [paymentForm, setPaymentForm] = useState({ monto: '', metodo_pago: 'transferencia', nota: '' });
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('todos');
  const [paymentFilter, setPaymentFilter] = useState('todos');

  const recentSales = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sales.filter((sale) => {
      const status = String(sale.estado || 'cotizada').toLowerCase();
      const paymentStatus = String(sale.estado_pago || 'pendiente').toLowerCase();
      const details = Array.isArray(sale.detalles) ? sale.detalles : [];
      const matchesState = stateFilter === 'todos' || status === stateFilter;
      const matchesPayment = paymentFilter === 'todos' || paymentStatus === paymentFilter;
      const matchesSearch = !term
        || String(sale.id).includes(term)
        || String(sale.cliente?.nombre || '').toLowerCase().includes(term)
        || details.some((detail) => String(detail.nombre_producto || '').toLowerCase().includes(term));
      return matchesState && matchesPayment && matchesSearch;
    }).slice(0, 40);
  }, [paymentFilter, sales, search, stateFilter]);

  const loadSales = async () => {
    // Por defecto muestra ventas de hoy; clientes puede inyectar su propio origen.
    setLoading(true);
    try {
      const response = loadSalesRequest ? await loadSalesRequest() : await saleService.getToday({ limit: 40 });
      setSales(getArrayData(response));
    } catch (err) {
      toast.error(err.message || 'No se pudieron cargar las ventas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Carga al abrir para mostrar datos frescos después de nuevas ventas.
    if (open) loadSales();
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    // Escape cierra el modal como comportamiento esperado en escritorio.
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const cancelSale = async (sale) => {
    // Anular puede devolver stock, por eso se pide confirmación explícita.
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

  const openPaymentForm = (sale, mode = 'payment') => {
    setPaymentMode(mode);
    setPaymentSaleId(sale.id);
    setPaymentForm({ monto: String(Number(sale.saldo_pendiente || 0)), metodo_pago: 'transferencia', nota: '' });
  };

  const registerPayment = async (sale) => {
    const amount = Math.max(0, Number(paymentForm.monto) || 0);
    if (paymentMode !== 'confirm' && amount <= 0) {
      toast.error('Ingresa un monto mayor a 0');
      return;
    }
    if (amount > Number(sale.saldo_pendiente || 0)) {
      toast.error('El pago supera el saldo pendiente');
      return;
    }

    const toastId = toast.loading(paymentMode === 'confirm' ? 'Confirmando cotización...' : 'Registrando pago...');
    try {
      if (paymentMode === 'confirm') {
        await saleService.confirm(sale.id, paymentForm.metodo_pago, socket.id || null, amount);
        toast.success('Cotización confirmada', { id: toastId });
      } else {
        await saleService.registerPayment(sale.id, {
          monto: amount,
          metodo_pago: paymentForm.metodo_pago,
          nota: paymentForm.nota || null
        });
        toast.success('Pago registrado', { id: toastId });
      }
      setPaymentSaleId(null);
      await loadSales();
      await onChanged?.();
    } catch (err) {
      toast.error(err.message || (paymentMode === 'confirm' ? 'No se pudo confirmar la cotización' : 'No se pudo registrar el pago'), { id: toastId });
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-xl">
      <div className="relative flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[#111418]/95 shadow-soft">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">{subtitle}</p>
            <div className="mt-1 flex items-center gap-2">
              <ReceiptText size={22} className="text-sky-100" />
              <h2 className="font-display text-2xl font-semibold text-white">{title}</h2>
            </div>
            {description && <p className="mt-2 text-sm text-zinc-400">{description}</p>}
          </div>
          <button className="icon-button h-10 w-10 shrink-0" type="button" onClick={onClose} title="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
            <label className="field-label">
              Buscar
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                <input className="field-input with-icon" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Venta o producto" />
              </div>
            </label>
            <label className="field-label">
              Estado
              <select className="field-input" value={stateFilter} onChange={(event) => setStateFilter(event.target.value)}>
                <option value="todos">Todos</option>
                <option value="cotizada">Cotizadas</option>
                <option value="confirmada">Confirmadas</option>
                <option value="anulada">Anuladas</option>
              </select>
            </label>
            <label className="field-label">
              Pago
              <select className="field-input" value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)}>
                <option value="todos">Todos</option>
                <option value="pendiente">Pendientes</option>
                <option value="parcial">Abonadas</option>
                <option value="pagada">Pagadas</option>
              </select>
            </label>
          </div>

          {loading && (
            <div className="flex min-h-[18rem] items-center justify-center gap-3 text-zinc-400">
              <Loader2 size={20} className="animate-spin" />
              Cargando ventas...
            </div>
          )}

          {!loading && recentSales.length === 0 && (
            <div className="rounded-[1.5rem] border border-dashed border-white/10 p-8 text-center text-zinc-500">
              No hay ventas para mostrar.
            </div>
          )}

          {!loading && recentSales.length > 0 && (
            <div className="grid gap-3">
              {recentSales.map((sale) => {
                const status = String(sale.estado || 'cotizada').toLowerCase();
                const paymentStatus = String(sale.estado_pago || 'pendiente').toLowerCase();
                const details = Array.isArray(sale.detalles) ? sale.detalles : [];
                const payments = Array.isArray(sale.pagos) ? sale.pagos : [];
                const canCancel = status !== 'anulada';
                const totalPaid = Number(sale.total_pagado || payments.reduce((sum, payment) => sum + Number(payment.monto || 0), 0));
                const pending = Number(sale.saldo_pendiente ?? Math.max(0, getSaleTotal(sale) - totalPaid));
                const canPay = status === 'confirmada' && pending > 0;
                const canConfirm = status === 'cotizada';

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
                          <span className={`rounded-full border px-3 py-1 text-xs font-bold ${paymentStateStyles[paymentStatus] || paymentStateStyles.pendiente}`}>
                            {paymentStateLabels[paymentStatus] || paymentStatus}
                          </span>
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
                        {payments.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-400">
                            {payments.slice(0, 4).map((payment) => (
                              <span key={payment.id} className="rounded-full border border-white/10 bg-black/20 px-3 py-1">
                                {formatCurrency(payment.monto)} · {PAYMENT_METHOD_LABELS[payment.metodo_pago] || payment.metodo_pago}
                              </span>
                            ))}
                            {payments.length > 4 && <span className="px-2 py-1">+{payments.length - 4} pagos</span>}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-3 lg:min-w-48 lg:items-end">
                        <div className="rounded-[1.2rem] border border-white/10 bg-black/25 px-4 py-3 text-right">
                          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Total</p>
                          <p className="mt-1 font-display text-2xl font-semibold text-sky-100">{formatCurrency(getSaleTotal(sale))}</p>
                          <p className="mt-2 text-xs text-zinc-400">Pagado {formatCurrency(totalPaid)}</p>
                          <p className="text-xs text-amber-100">Saldo {formatCurrency(pending)}</p>
                        </div>
                        {paymentSaleId === sale.id ? (
                          <div className="w-full space-y-2 rounded-[1.2rem] border border-white/10 bg-black/25 p-3 lg:w-64">
                            <input
                              className="field-input compact-input"
                              min={paymentMode === 'confirm' ? '0' : '1'}
                              max={pending}
                              type="number"
                              value={paymentForm.monto}
                              onChange={(event) => setPaymentForm((current) => ({ ...current, monto: event.target.value }))}
                              placeholder="Monto"
                            />
                            <select
                              className="field-input compact-input"
                              value={paymentForm.metodo_pago}
                              onChange={(event) => setPaymentForm((current) => ({ ...current, metodo_pago: event.target.value }))}
                            >
                              <option value="transferencia">Transferencia</option>
                              <option value="debito_credito">Débito/crédito</option>
                              <option value="efectivo">Efectivo</option>
                            </select>
                            {paymentMode !== 'confirm' && (
                              <input
                                className="field-input compact-input"
                                value={paymentForm.nota}
                                onChange={(event) => setPaymentForm((current) => ({ ...current, nota: event.target.value }))}
                                placeholder="Nota opcional"
                              />
                            )}
                            <div className="grid grid-cols-2 gap-2">
                              <button className="soft-button" type="button" onClick={() => registerPayment(sale)}>{paymentMode === 'confirm' ? 'Confirmar' : 'Guardar'}</button>
                              <button className="ghost-button" type="button" onClick={() => setPaymentSaleId(null)}>Cancelar</button>
                            </div>
                          </div>
                        ) : (
                          <div className="grid w-full gap-2 lg:w-auto">
                            {canConfirm && (
                              <button className="soft-button w-full lg:w-auto" type="button" onClick={() => openPaymentForm(sale, 'confirm')}>
                                Confirmar cotización
                              </button>
                            )}
                            <button
                              className="soft-button w-full lg:w-auto"
                              type="button"
                              disabled={!canPay}
                              onClick={() => openPaymentForm(sale)}
                            >
                              Registrar pago
                            </button>
                          </div>
                        )}
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
