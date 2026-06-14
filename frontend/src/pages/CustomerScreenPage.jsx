import { useEffect, useRef, useState } from 'react';
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
  const lastItemRef = useRef(null);

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
    socket.on('sale:update', updateQuote);
    socket.on('sale:clear', clearQuote);
    if (socket.connected) join();

    return () => {
      socket.off('connect', join);
      socket.off('disconnect', disconnect);
      socket.off('sale:update', updateQuote);
      socket.off('sale:clear', clearQuote);
    };
  }, [screenId]);

  const hasQuote = quote.items?.length > 0;
  const getDiscount = (item) => Number(item.descuento_aplicado ?? item.descuento ?? 0);

  useEffect(() => {
    if (!hasQuote) return;

    const timer = window.setTimeout(() => {
      lastItemRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest'
      });
    }, 80);

    return () => window.clearTimeout(timer);
  }, [hasQuote, quote.items?.length, quote.total]);

  return (
    <main className="customer-screen min-h-screen overflow-x-hidden bg-[#050608] p-3 text-white sm:p-5 lg:p-6">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(125,211,252,0.16),transparent_30%),linear-gradient(145deg,#050608,#17191d)]" />
      <section className="customer-shell relative mx-auto flex min-h-[calc(100vh-1.5rem)] max-w-7xl flex-col rounded-[1.6rem] border border-white/10 bg-white/[0.045] p-4 shadow-soft sm:min-h-[calc(100vh-2.5rem)] sm:rounded-[2.4rem] sm:p-6 lg:rounded-[3rem] lg:p-8">
        <header className="customer-header flex flex-col gap-4 border-b border-white/10 pb-5 md:flex-row md:items-center md:justify-between md:gap-5 md:pb-7">
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
            <div className="customer-header-logo flex h-16 w-36 shrink-0 items-center justify-center p-0 sm:h-20 sm:w-44">
              <img className="max-h-full max-w-full scale-125 object-contain" src={logoFerreteria} alt="Ferretería Castillo SPA" />
            </div>
            <div className="min-w-0">
              <p className="customer-eyebrow text-xs uppercase tracking-[0.22em] text-sky-200/80 sm:text-sm md:text-lg md:tracking-[0.36em]">
                Ferretería Castillo SPA
              </p>
              <h1 className="customer-title mt-2 font-display text-3xl font-semibold sm:text-4xl md:mt-4 md:text-5xl">
                Cotización actual
              </h1>
            </div>
          </div>
          <div className="customer-status w-fit rounded-full border border-white/10 bg-black/30 px-4 py-2 text-base shadow-insetSoft sm:px-6 sm:py-3 sm:text-xl">
            <Monitor className="mr-2 inline" /> {connected ? 'Conectado' : 'Sin conexión'}
          </div>
        </header>

        {!hasQuote ? (
          <div className="flex flex-1 items-center justify-center text-center">
            <div className="max-w-2xl">
              <p className="customer-empty-title text-3xl font-semibold text-zinc-300 sm:text-4xl">Esperando cotización</p>
              <p className="customer-empty-copy mt-3 text-lg text-zinc-500 sm:mt-4 sm:text-xl">
                El detalle aparecerá automáticamente cuando el vendedor lo envíe.
              </p>
            </div>
          </div>
        ) : (
          <div className="customer-quote-grid grid flex-1 items-start gap-5 pt-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] xl:gap-8 xl:pt-7">
            <div className="customer-items min-h-0 max-h-[58vh] space-y-3 overflow-y-auto overflow-x-hidden pr-1 sm:space-y-4 xl:max-h-[calc(100vh-15rem)]">
              {quote.items.map((item, index) => {
                const discount = getDiscount(item);

                return (
                  <div
                    key={`${item.nombre_producto}-${index}`}
                    ref={index === quote.items.length - 1 ? lastItemRef : null}
                    className={`customer-line animate-soft-in rounded-[1.35rem] border p-4 shadow-insetSoft sm:rounded-[1.7rem] sm:p-5 ${
                      index === quote.items.length - 1
                        ? 'border-sky-200/30 bg-sky-200/[0.08]'
                        : 'border-white/10 bg-black/25'
                    }`}
                  >
                    <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                      <div className="min-w-0">
                        <strong className="block text-lg leading-snug text-white sm:text-xl lg:text-2xl xl:text-[1.35rem]">
                          {item.nombre_producto}
                        </strong>
                        <div className="mt-2 flex flex-wrap gap-2 text-sm text-zinc-400 sm:text-base">
                          <span className="rounded-full border border-white/10 px-3 py-1">Cantidad x{item.cantidad}</span>
                          <span className="rounded-full border border-white/10 px-3 py-1">{formatCurrency(item.precio_unitario)} c/u</span>
                          {discount > 0 && (
                            <span className="rounded-full border border-sky-200/30 bg-sky-200/10 px-3 py-1 text-sky-100">
                              Descuento {discount}%
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-right text-xl font-semibold text-sky-100 sm:text-2xl lg:text-3xl xl:text-[1.65rem]">
                        {formatCurrency(item.subtotal)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <aside className="customer-summary flex flex-col justify-between rounded-[1.5rem] border border-white/10 bg-white/[0.07] p-5 shadow-soft sm:rounded-[2.2rem] sm:p-7 lg:rounded-[2.5rem] lg:p-8">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-zinc-500 sm:text-lg">Cliente</p>
                <h2 className="customer-client-name mt-3 break-words text-3xl font-semibold sm:text-4xl">{quote.cliente?.nombre || 'Cliente'}</h2>
                <p className="mt-2 text-lg text-zinc-400 sm:text-xl">{quote.cliente?.telefono || ''}</p>
              </div>
              <div className="mt-8 sm:mt-12">
                <p className="text-lg text-zinc-400 sm:text-xl">Total</p>
                <p className="customer-total mt-3 break-words font-display text-5xl font-semibold text-white sm:text-6xl xl:text-7xl">
                  {formatCurrency(quote.total)}
                </p>
              </div>
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}
