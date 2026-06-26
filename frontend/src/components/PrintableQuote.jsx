import { useEffect, useMemo } from 'react';
import { Printer } from 'lucide-react';
import logoFerreteria from '../assets/logo-ferreteria-castillo.png';
import { formatCurrency } from '../utils/formatCurrency.js';
import { PAYMENT_METHOD_LABELS } from '../utils/quoteCalculations.js';

const getQuote = () => {
  try {
    const storedQuote = localStorage.getItem('printableQuote') || sessionStorage.getItem('printableQuote');
    return JSON.parse(storedQuote || '{}');
  } catch {
    return {};
  }
};

const normalizeItem = (item) => {
  const precio = Number(item.precio ?? item.precio_unitario ?? 0);
  const cantidad = Number(item.cantidad ?? 0);
  const descuento = Number(item.descuento_aplicado ?? 0);
  const precioFinal = Math.floor((precio * (100 - descuento) + 50) / 100);

  return {
    id: item.id ?? item.Producto_id ?? item.nombre ?? item.nombre_producto,
    nombre: item.nombre ?? item.nombre_producto ?? 'Producto',
    precio,
    cantidad,
    descuento,
    precioFinal,
    subtotal: Number(item.subtotal ?? precioFinal * cantidad)
  };
};

export default function PrintableQuote() {
  const quote = useMemo(getQuote, []);
  const items = useMemo(() => (quote.items || []).map(normalizeItem), [quote.items]);
  const total = Number(quote.total || items.reduce((sum, item) => sum + item.subtotal, 0));
  const quoteDate = quote.fecha ? new Date(quote.fecha) : new Date();

  useEffect(() => {
    const timer = window.setTimeout(() => window.print(), 450);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main className="print-shell min-h-screen bg-zinc-200 p-4 text-zinc-950 sm:p-6">
      <div className="no-print mx-auto mb-4 flex max-w-5xl justify-end">
        <button className="rounded-full bg-zinc-950 px-5 py-3 font-bold text-white shadow-lg" onClick={() => window.print()}>
          <Printer className="mr-2 inline" size={18} /> Generar PDF
        </button>
      </div>

      <section className="print-area mx-auto flex min-h-[calc(100vh-3rem)] max-w-5xl flex-col overflow-hidden rounded-[1rem] bg-white shadow-2xl">
        <header className="border-b-[3px] border-black bg-white px-6 py-4 text-black">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-40 items-center justify-center rounded-xl border border-zinc-300 bg-white p-1.5">
                <img className="max-h-full max-w-full object-contain grayscale" src={logoFerreteria} alt="Ferretería Castillo SPA" />
              </div>
              <div>
                <p className="text-[0.65rem] font-bold uppercase tracking-[0.34em] text-zinc-500">Cotización comercial</p>
                <h1 className="mt-2 text-3xl font-black leading-tight tracking-tight">Ferretería Castillo SPA</h1>
              </div>
            </div>
            <div className="rounded-xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-left sm:text-right">
              <p className="text-xs text-zinc-500">Fecha</p>
              <p className="text-lg font-bold leading-tight">{quoteDate.toLocaleDateString('es-CL')}</p>
              <p className="mt-1 text-xs text-zinc-500">Válida por 7 días</p>
            </div>
          </div>
        </header>

        <section className="grid gap-3 border-b border-zinc-300 bg-zinc-50 px-6 py-4 sm:grid-cols-2">
          <div>
            <p className="text-[0.65rem] font-black uppercase tracking-[0.22em] text-zinc-500">Cliente</p>
            <p className="mt-1 text-xl font-black">{quote.cliente?.nombre || 'Sin nombre'}</p>
          </div>
          <div className="sm:text-right">
            <p className="text-[0.65rem] font-black uppercase tracking-[0.22em] text-zinc-500">Teléfono</p>
            <p className="mt-1 text-lg font-bold">{quote.cliente?.telefono || 'No informado'}</p>
          </div>
        </section>

        <section className="flex-1 px-6 py-4">
          <table className="w-full table-fixed border-collapse text-left text-sm">
            <thead>
              <tr className="border-y-2 border-black bg-zinc-100 text-[0.62rem] uppercase tracking-[0.14em] text-black">
                <th className="w-[34%] px-3 py-3">Producto</th>
                <th className="w-[8%] px-2 py-3 text-center">Cant.</th>
                <th className="w-[15%] px-2 py-3 text-right">Precio</th>
                <th className="w-[10%] px-2 py-3 text-center">Desc.</th>
                <th className="w-[15%] px-2 py-3 text-right">P. final</th>
                <th className="w-[18%] px-3 py-3 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td className="px-3 py-8 text-center text-zinc-500" colSpan="6">
                    No hay productos para imprimir.
                  </td>
                </tr>
              )}
              {items.map((item, index) => (
                <tr key={item.id || `${item.nombre}-${index}`} className="break-inside-avoid border-b border-zinc-200">
                  <td className="px-3 py-3 font-bold leading-snug">{item.nombre}</td>
                  <td className="px-2 py-3 text-center">{item.cantidad}</td>
                  <td className="px-2 py-3 text-right">{formatCurrency(item.precio)}</td>
                  <td className="px-2 py-3 text-center">{item.descuento}%</td>
                  <td className="px-2 py-3 text-right font-bold">{formatCurrency(item.precioFinal)}</td>
                  <td className="px-3 py-3 text-right font-black">{formatCurrency(item.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <footer className="grid gap-5 border-t border-zinc-300 bg-zinc-50 px-6 py-4 sm:grid-cols-[1fr_270px] sm:items-stretch">
          <div className="rounded-xl border border-zinc-300 bg-white p-4">
            <p className="text-[0.65rem] font-black uppercase tracking-[0.22em] text-zinc-500">Observación</p>
            <p className="mt-2 text-xs leading-5 text-zinc-600">
              Precios sujetos a disponibilidad y confirmación al momento de compra.
            </p>
            {quote.metodo_pago && (
              <p className="mt-2 text-xs font-bold text-zinc-800">
                Método de pago: {PAYMENT_METHOD_LABELS[quote.metodo_pago] || quote.metodo_pago}
              </p>
            )}
          </div>
          <div className="rounded-xl border-2 border-black bg-white p-5 text-black">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">Total</p>
            <p className="mt-2 text-3xl font-black">{formatCurrency(total)}</p>
          </div>
        </footer>
      </section>
    </main>
  );
}
