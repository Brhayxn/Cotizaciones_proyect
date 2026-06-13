import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Monitor } from 'lucide-react';
import { socket } from '../config/socket.js';
import { formatCurrency } from '../utils/formatCurrency.js';
import logoFerreteria from '../assets/logo-ferreteria-castillo.png';

export default function CustomerScreenPage() {
  const params = useParams();
  const screenId = params.screenId || 'pantalla-1';
  const [quote, setQuote] = useState({ cliente: null, items: [], total: 0 });
  const [connected, setConnected] = useState(socket.connected);

  useEffect(() => {
    const join = () => {
      setConnected(true);
      socket.emit('screen:join', { screenId });
    };
    const disconnect = () => setConnected(false);
    const updateQuote = (data) => setQuote(data || { cliente: null, items: [], total: 0 });
    const clearQuote = () => setQuote({ cliente: null, items: [], total: 0 });

    socket.on('connect', join);
    socket.on('disconnect', disconnect);
    socket.on('quote:update', updateQuote);
    socket.on('quote:clear', clearQuote);
    if (socket.connected) join();

    return () => {
      socket.off('connect', join);
      socket.off('disconnect', disconnect);
      socket.off('quote:update', updateQuote);
      socket.off('quote:clear', clearQuote);
    };
  }, [screenId]);

  const hasQuote = quote.items?.length > 0;

  return (
    <main className="customer-screen min-h-screen overflow-x-hidden bg-[#050608] p-4 text-white sm:p-6">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(125,211,252,0.16),transparent_30%),linear-gradient(145deg,#050608,#17191d)]" />
      <section className="customer-shell relative mx-auto flex min-h-[calc(100vh-2rem)] max-w-7xl flex-col rounded-[1.6rem] border border-white/10 bg-white/[0.045] p-4 shadow-soft sm:min-h-[calc(100vh-3rem)] sm:rounded-[3rem] sm:p-8">
        <header className="customer-header flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-center sm:justify-between sm:gap-5 sm:pb-8">
          <div className="flex items-center gap-5">
            <div className="customer-header-logo flex h-20 w-44 shrink-0 items-center justify-center p-0 me-4">
              <img className="max-h-full max-w-full scale-125 object-contain" src={logoFerreteria} alt="Ferretería Castillo SPA" />
            </div>
            <div>
              <p className="customer-eyebrow text-sm uppercase tracking-[0.3em] text-sky-200/80 sm:text-lg sm:tracking-[0.36em]">Ferretería Castillo SPA</p>
              <h1 className="customer-title mt-3 font-display text-4xl font-semibold sm:mt-4 sm:text-5xl">Cotización actual</h1>
            </div>
          </div>
          <div className="customer-status rounded-full border border-white/10 bg-black/30 px-4 py-2 text-base shadow-insetSoft sm:px-6 sm:py-3 sm:text-xl">
            <Monitor className="mr-2 inline" /> {connected ? 'Conectado' : 'Sin conexión'}
          </div>
        </header>

        {!hasQuote ? (
          <div className="flex flex-1 items-center justify-center text-center">
            <div className="max-w-2xl">
              <p className="customer-empty-title text-3xl font-semibold text-zinc-300 sm:text-4xl">Esperando cotización</p>
              <p className="customer-empty-copy mt-3 text-lg text-zinc-500 sm:mt-4 sm:text-xl">El detalle aparecerá automáticamente cuando el vendedor lo envíe.</p>
            </div>
          </div>
        ) : (
          <div className="customer-quote-grid grid flex-1 items-start gap-5 pt-5 lg:grid-cols-[1fr_420px] lg:gap-8 lg:pt-8">
            <div className="customer-items min-h-0 space-y-3 overflow-y-auto pr-1 sm:space-y-4">
              {quote.items.map((item, index) => (
                <div
                  key={`${item.nombre_producto}-${index}`}
                  className="customer-line animate-soft-in grid gap-3 rounded-[1.35rem] border border-white/10 bg-black/25 p-4 text-lg shadow-insetSoft sm:grid-cols-[1fr_110px_180px_190px] sm:items-center sm:rounded-[2rem] sm:p-6 sm:text-2xl"
                >
                  <strong>{item.nombre_producto}</strong>
                  <span className="text-center text-zinc-300">x{item.cantidad}</span>
                  <span className="text-right text-zinc-300">{formatCurrency(item.precio_unitario)}</span>
                  <span className="text-right font-semibold text-sky-100">{formatCurrency(item.subtotal)}</span>
                </div>
              ))}
            </div>
            <aside className="customer-summary flex flex-col justify-between rounded-[1.5rem] border border-white/10 bg-white/[0.07] p-5 shadow-soft sm:rounded-[2.5rem] sm:p-8">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-zinc-500 sm:text-lg">Cliente</p>
                <h2 className="customer-client-name mt-3 text-3xl font-semibold sm:text-4xl">{quote.cliente?.nombre || 'Cliente'}</h2>
                <p className="mt-2 text-lg text-zinc-400 sm:text-xl">{quote.cliente?.telefono || ''}</p>
              </div>
              <div className="mt-8 sm:mt-12">
                <p className="text-lg text-zinc-400 sm:text-xl">Total</p>
                <p className="customer-total mt-3 font-display text-5xl font-semibold text-white sm:text-7xl">{formatCurrency(quote.total)}</p>
              </div>
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}
