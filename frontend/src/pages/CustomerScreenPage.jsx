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
    <main className="min-h-screen overflow-hidden bg-[#050608] p-6 text-white">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(125,211,252,0.16),transparent_30%),linear-gradient(145deg,#050608,#17191d)]" />
      <section className="relative mx-auto flex min-h-[calc(100vh-3rem)] max-w-7xl flex-col rounded-[3rem] border border-white/10 bg-white/[0.045] p-8 shadow-soft">
        <header className="flex flex-col gap-5 border-b border-white/10 pb-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            <div>
              <p className="text-lg uppercase tracking-[0.36em] text-sky-200/80">Ferretería Castillo SPA</p>
              <h1 className="mt-4 font-display text-5xl font-semibold sm:text-7xl">Cotización actual</h1>
            </div>
          </div>
          <div className="rounded-full border border-white/10 bg-black/30 px-6 py-3 text-xl shadow-insetSoft">
            <Monitor className="mr-2 inline" /> {connected ? 'Conectado' : 'Sin conexión'}
          </div>
        </header>

        {!hasQuote ? (
          <div className="flex flex-1 items-center justify-center text-center">
            <div className="max-w-2xl">
              <div className="mx-auto mb-8 flex h-40 w-72 items-center justify-center rounded-[2rem] border border-white/10 bg-black/20 p-4 shadow-insetSoft">
                <img className="max-h-full max-w-full object-contain" src={logoFerreteria} alt="Ferretería Castillo SPA" />
              </div>
              <p className="text-4xl font-semibold text-zinc-300">Esperando cotización</p>
              <p className="mt-4 text-xl text-zinc-500">El detalle aparecerá automáticamente cuando el vendedor lo envíe.</p>
            </div>
          </div>
        ) : (
          <div className="grid flex-1 gap-8 pt-8 lg:grid-cols-[1fr_420px]">
            <div className="space-y-4">
              {quote.items.map((item, index) => (
                <div
                  key={`${item.nombre_producto}-${index}`}
                  className="animate-soft-in grid gap-4 rounded-[2rem] border border-white/10 bg-black/25 p-6 text-2xl shadow-insetSoft sm:grid-cols-[1fr_110px_180px_190px] sm:items-center"
                >
                  <strong>{item.nombre_producto}</strong>
                  <span className="text-center text-zinc-300">x{item.cantidad}</span>
                  <span className="text-right text-zinc-300">{formatCurrency(item.precio_unitario)}</span>
                  <span className="text-right font-semibold text-sky-100">{formatCurrency(item.subtotal)}</span>
                </div>
              ))}
            </div>
            <aside className="flex flex-col justify-between rounded-[2.5rem] border border-white/10 bg-white/[0.07] p-8 shadow-soft">
              <div>
                <p className="text-lg uppercase tracking-[0.3em] text-zinc-500">Cliente</p>
                <h2 className="mt-3 text-4xl font-semibold">{quote.cliente?.nombre || 'Cliente'}</h2>
                <p className="mt-2 text-xl text-zinc-400">{quote.cliente?.telefono || ''}</p>
              </div>
              <div className="mt-12">
                <p className="text-xl text-zinc-400">Total</p>
                <p className="mt-3 font-display text-7xl font-semibold text-white">{formatCurrency(quote.total)}</p>
              </div>
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}
