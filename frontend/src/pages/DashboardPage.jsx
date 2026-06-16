import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  Clock3,
  PackageCheck,
  ReceiptText,
  RefreshCw,
  TrendingUp,
  WalletCards
} from 'lucide-react';
import toast from 'react-hot-toast';
import { saleService } from '../services/saleService.js';
import { formatCurrency } from '../utils/formatCurrency.js';

const CHILE_TIME_ZONE = 'America/Santiago';
const dayFormatter = new Intl.DateTimeFormat('es-CL', {
  timeZone: CHILE_TIME_ZONE,
  weekday: 'short'
});
const dateFormatter = new Intl.DateTimeFormat('es-CL', {
  timeZone: CHILE_TIME_ZONE,
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit'
});
const dayKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: CHILE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});
const hourFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: CHILE_TIME_ZONE,
  hour: '2-digit',
  hour12: false
});

const normalizeDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const formatCompactCurrency = (value = 0) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(Number(value) || 0);

const toPercent = (value, max) => {
  if (!max) return 0;
  return Math.max(5, Math.round((value / max) * 100));
};

const getChileDayKey = (date) => dayKeyFormatter.format(date);
const getChileHour = (date) => Number(hourFormatter.format(date).replace('24', '00'));
const getSaleState = (sale) => String(sale.estado || '').trim().toLowerCase();
const getSaleTotal = (sale) => Number(sale.totalVenta ?? sale.total ?? sale.totalCotizacion ?? 0);
const getSaleDetails = (sale) => (Array.isArray(sale.detalles) ? sale.detalles : []);

const buildInsights = (sales = []) => {
  const activeSales = sales.filter((sale) => getSaleState(sale) !== 'anulada');
  const confirmedSales = sales.filter((sale) => getSaleState(sale) === 'confirmada');
  const quotedSales = sales.filter((sale) => getSaleState(sale) === 'cotizada');
  const totalRevenue = confirmedSales.reduce((sum, sale) => sum + getSaleTotal(sale), 0);
  const totalItems = confirmedSales.reduce(
    (sum, sale) => sum + getSaleDetails(sale).reduce((itemSum, item) => itemSum + Number(item.cantidad || 0), 0),
    0
  );

  const productMap = new Map();
  const hourMap = new Map();
  const dayMap = new Map();
  const now = new Date();

  for (let index = 6; index >= 0; index -= 1) {
    const day = new Date(now);
    day.setDate(now.getDate() - index);
    const key = getChileDayKey(day);
    dayMap.set(key, {
      key,
      label: dayFormatter.format(day).replace('.', ''),
      total: 0,
      count: 0
    });
  }

  for (const sale of confirmedSales) {
    const saleDate = normalizeDate(sale.fecha || sale.createdAt);
    const hour = getChileHour(saleDate);
    const hourBucket = hourMap.get(hour) || { hour, count: 0, total: 0 };
    hourBucket.count += 1;
    hourBucket.total += getSaleTotal(sale);
    hourMap.set(hour, hourBucket);

    const dayKey = getChileDayKey(saleDate);
    if (dayMap.has(dayKey)) {
      const dayBucket = dayMap.get(dayKey);
      dayBucket.total += getSaleTotal(sale);
      dayBucket.count += 1;
    }

    for (const detail of getSaleDetails(sale)) {
      const name = detail.nombre_producto || detail.producto?.nombre || 'Producto sin nombre';
      const previous = productMap.get(name) || { name, units: 0, total: 0 };
      previous.units += Number(detail.cantidad || 0);
      previous.total += Number(detail.subtotal || 0);
      productMap.set(name, previous);
    }
  }

  const products = [...productMap.values()].sort((a, b) => b.units - a.units).slice(0, 5);
  const hours = [...hourMap.values()].sort((a, b) => a.hour - b.hour);
  const peakHour = [...hourMap.values()].sort((a, b) => b.count - a.count || b.total - a.total)[0];
  const dailySales = [...dayMap.values()];
  const maxDaily = Math.max(...dailySales.map((day) => day.total), 0);
  const maxHour = Math.max(...hours.map((hour) => hour.count), 0);
  const maxProduct = Math.max(...products.map((product) => product.units), 0);
  const averageTicket = confirmedSales.length ? Math.round(totalRevenue / confirmedSales.length) : 0;
  const conversionRate = activeSales.length ? Math.round((confirmedSales.length / activeSales.length) * 100) : 0;
  const latestConfirmed = confirmedSales
    .slice()
    .sort((a, b) => normalizeDate(b.fecha || b.createdAt) - normalizeDate(a.fecha || a.createdAt))
    .slice(0, 3);

  return {
    activeSales,
    averageTicket,
    confirmedSales,
    conversionRate,
    dailySales,
    hours,
    latestConfirmed,
    maxDaily,
    maxHour,
    maxProduct,
    peakHour,
    products,
    quotedSales,
    totalItems,
    totalRevenue
  };
};

function MetricCard({ icon: Icon, label, value, detail, tone = 'lime' }) {
  const toneClass = tone === 'sky' ? 'from-sky-200 to-cyan-300' : tone === 'amber' ? 'from-amber-200 to-lime-200' : 'from-lime-200 to-lime-400';

  return (
    <section className="glass-card rounded-[1.55rem] border border-white/10 p-4 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">{label}</p>
          <strong className="mt-3 block font-display text-2xl font-semibold text-zinc-50 sm:text-3xl">{value}</strong>
        </div>
        <span className={`grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br ${toneClass} text-black shadow-glow`}>
          <Icon size={20} strokeWidth={2.4} />
        </span>
      </div>
      <p className="mt-4 text-sm font-medium text-zinc-400">{detail}</p>
    </section>
  );
}

function EmptyState() {
  return (
    <section className="glass-card rounded-[1.75rem] border border-white/10 p-6 text-center shadow-soft">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-lime-300 text-black">
        <ReceiptText size={25} strokeWidth={2.4} />
      </div>
      <h2 className="mt-4 font-display text-2xl font-semibold text-white">Aun no hay ventas para analizar</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm font-medium text-zinc-400">
        Cuando registres ventas confirmadas, este panel mostrara ganancias, productos destacados y horarios fuertes.
      </p>
    </section>
  );
}

export default function DashboardPage() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadSales = async () => {
    try {
      setLoading(true);
      const response = await saleService.getAll();
      const nextSales = Array.isArray(response) ? response : response.data || [];
      setSales(nextSales);
    } catch (error) {
      toast.error('No se pudieron cargar las ventas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSales();
  }, []);

  const insights = useMemo(() => buildInsights(sales), [sales]);
  const peakHourLabel = insights.peakHour ? `${String(insights.peakHour.hour).padStart(2, '0')}:00` : '--:--';

  return (
    <div className="dashboard-view space-y-4 pb-24 lg:pb-2">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(24rem,0.92fr)]">
        <div className="glass-card relative min-h-[19rem] overflow-hidden rounded-[1.75rem] border border-white/10 p-5 shadow-soft">
          <div className="absolute inset-x-8 top-8 h-24 rounded-full bg-lime-300/10 blur-3xl" />
          <div className="relative flex h-full flex-col justify-between gap-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-lime-200/75">Resumen comercial</p>
                <h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold leading-tight text-white sm:text-4xl">
                  Ventas confirmadas, demanda y horarios de mayor movimiento
                </h2>
              </div>
              <button
                type="button"
                onClick={loadSales}
                className="icon-button shrink-0"
                aria-label="Actualizar dashboard"
                title="Actualizar dashboard"
              >
                <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[1.25rem] border border-lime-200/15 bg-lime-300/[0.08] p-4">
                <span className="text-xs font-bold uppercase tracking-[0.24em] text-lime-100/75">Ganancias</span>
                <strong className="mt-2 block font-display text-3xl font-semibold text-lime-100">
                  {formatCurrency(insights.totalRevenue)}
                </strong>
              </div>
              <div className="rounded-[1.25rem] border border-white/10 bg-black/20 p-4">
                <span className="text-xs font-bold uppercase tracking-[0.24em] text-zinc-500">Ticket medio</span>
                <strong className="mt-2 block font-display text-2xl font-semibold text-white">
                  {formatCurrency(insights.averageTicket)}
                </strong>
              </div>
              <div className="rounded-[1.25rem] border border-white/10 bg-black/20 p-4">
                <span className="text-xs font-bold uppercase tracking-[0.24em] text-zinc-500">Hora peak</span>
                <strong className="mt-2 block font-display text-2xl font-semibold text-white">{peakHourLabel}</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <MetricCard
            icon={ReceiptText}
            label="Ventas realizadas"
            value={insights.confirmedSales.length}
            detail={`${insights.quotedSales.length} cotizaciones abiertas y ${insights.activeSales.length} operaciones vigentes.`}
          />
          <MetricCard
            icon={PackageCheck}
            label="Unidades vendidas"
            value={insights.totalItems}
            detail="Suma de unidades en ventas confirmadas."
            tone="sky"
          />
        </div>
      </section>

      {sales.length === 0 && !loading ? (
        <EmptyState />
      ) : (
        <>
          <section className="grid gap-4 lg:grid-cols-4">
            <MetricCard
              icon={WalletCards}
              label="Ingreso compacto"
              value={formatCompactCurrency(insights.totalRevenue)}
              detail="Total confirmado sin incluir ventas anuladas."
            />
            <MetricCard
              icon={TrendingUp}
              label="Conversion"
              value={`${insights.conversionRate}%`}
              detail="Confirmadas sobre cotizaciones y ventas vigentes."
              tone="amber"
            />
            <MetricCard
              icon={Clock3}
              label="Franja fuerte"
              value={peakHourLabel}
              detail={insights.peakHour ? `${insights.peakHour.count} ventas en esa hora.` : 'Sin actividad confirmada.'}
              tone="sky"
            />
            <MetricCard
              icon={Activity}
              label="Promedio"
              value={formatCompactCurrency(insights.averageTicket)}
              detail="Ticket promedio por venta confirmada."
            />
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="glass-card rounded-[1.75rem] border border-white/10 p-5 shadow-soft">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.26em] text-zinc-500">Ultimos 7 dias</p>
                  <h2 className="mt-2 font-display text-xl font-semibold text-white">Pulso diario de ventas</h2>
                </div>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-lime-100">Confirmadas</span>
              </div>
              <div className="flex h-64 items-end gap-3 rounded-[1.25rem] border border-white/10 bg-black/20 p-4">
                {insights.dailySales.map((day) => (
                  <div key={day.key} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-2">
                    <div className="relative flex flex-1 items-end overflow-hidden rounded-full bg-white/[0.06] shadow-insetSoft">
                      <div
                        className="w-full rounded-full bg-gradient-to-t from-lime-500 to-lime-200 shadow-glow transition-all duration-500"
                        style={{ height: `${toPercent(day.total, insights.maxDaily)}%` }}
                        title={formatCurrency(day.total)}
                      />
                    </div>
                    <span className="truncate text-center text-xs font-bold uppercase text-zinc-500">{day.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-card rounded-[1.75rem] border border-white/10 p-5 shadow-soft">
              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-zinc-500">Ventas recientes</p>
              <div className="mt-4 space-y-3">
                {insights.latestConfirmed.length ? (
                  insights.latestConfirmed.map((sale) => (
                    <div key={sale.id} className="rounded-[1.1rem] border border-white/10 bg-white/[0.045] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-white">Venta #{sale.id}</p>
                          <p className="mt-1 text-xs font-semibold text-zinc-500">{dateFormatter.format(normalizeDate(sale.fecha || sale.createdAt))}</p>
                        </div>
                        <ArrowUpRight className="shrink-0 text-lime-200" size={18} />
                      </div>
                      <strong className="mt-3 block font-display text-lg font-semibold text-lime-100">{formatCurrency(getSaleTotal(sale))}</strong>
                    </div>
                  ))
                ) : (
                  <p className="rounded-[1.1rem] border border-white/10 bg-white/[0.045] p-4 text-sm font-medium text-zinc-400">
                    Aun no existen ventas confirmadas.
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <div className="glass-card rounded-[1.75rem] border border-white/10 p-5 shadow-soft">
              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-zinc-500">Ranking</p>
              <h2 className="mt-2 font-display text-xl font-semibold text-white">Productos mas vendidos</h2>
              <div className="mt-5 space-y-4">
                {insights.products.length ? (
                  insights.products.map((product, index) => (
                    <div key={product.name}>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-white">
                            {index + 1}. {product.name}
                          </p>
                          <p className="text-xs font-semibold text-zinc-500">{formatCurrency(product.total)}</p>
                        </div>
                        <strong className="rounded-full bg-lime-300 px-3 py-1 text-sm text-black">{product.units}</strong>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-white/[0.07]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-lime-400 to-lime-200"
                          style={{ width: `${toPercent(product.units, insights.maxProduct)}%` }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-[1.1rem] border border-white/10 bg-white/[0.045] p-4 text-sm font-medium text-zinc-400">
                    Sin productos vendidos en ventas confirmadas.
                  </p>
                )}
              </div>
            </div>

            <div className="glass-card rounded-[1.75rem] border border-white/10 p-5 shadow-soft">
              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-zinc-500">Horario</p>
              <h2 className="mt-2 font-display text-xl font-semibold text-white">Horas con mayor venta</h2>
              <div className="mt-5 grid min-h-72 grid-cols-6 items-end gap-2 rounded-[1.25rem] border border-white/10 bg-black/20 p-4 sm:grid-cols-8 md:grid-cols-12">
                {insights.hours.length ? (
                  insights.hours.map((hour) => (
                    <div key={hour.hour} className="flex h-full flex-col justify-end gap-2">
                      <div className="relative flex flex-1 items-end overflow-hidden rounded-full bg-white/[0.06] shadow-insetSoft">
                        <div
                          className="w-full rounded-full bg-gradient-to-t from-zinc-600 via-lime-500 to-lime-200"
                          style={{ height: `${toPercent(hour.count, insights.maxHour)}%` }}
                          title={`${hour.count} ventas - ${formatCurrency(hour.total)}`}
                        />
                      </div>
                      <span className="text-center text-[0.68rem] font-bold text-zinc-500">{String(hour.hour).padStart(2, '0')}</span>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full grid h-full place-items-center text-sm font-medium text-zinc-400">
                    Sin ventas confirmadas por horario.
                  </div>
                )}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
