import { useState } from 'react';
import { Minus, Plus, Printer, Save, Send, Trash2, XCircle } from 'lucide-react';
import { formatCurrency } from '../utils/formatCurrency.js';
import GlassCard from './GlassCard.jsx';

export default function CartPanel({
  cart,
  total,
  cliente,
  setCliente,
  clientSuggestions = [],
  updateQuantity,
  updateDiscount,
  removeItem,
  onShow,
  onSave,
  onConfirm,
  onPrint,
  onClear,
  isScreenLive
}) {
  const [isClientSearchOpen, setIsClientSearchOpen] = useState(false);

  const updateClientField = (field, value) => {
    setCliente({ ...cliente, [field]: value });
    setIsClientSearchOpen(true);
  };

  const selectClient = (client) => {
    setCliente({
      nombre: client.nombre || '',
      telefono: client.telefono || ''
    });
    setIsClientSearchOpen(false);
  };

  const isOverflowMode = cart.length > 1;

  return (
    <GlassCard className={`cart-panel ${isOverflowMode ? 'cart-panel-overflow' : 'cart-panel-auto'} sticky top-5 flex max-h-[calc(100vh-10rem)] flex-col self-start p-3 lg:w-[350px] xl:w-[390px]`}>
      <div className="cart-panel-header mb-2 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Carrito</p>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="cart-panel-title text-[1.65rem] font-semibold leading-none">Cotización</h2>
            {isScreenLive && (
              <span className="rounded-full border border-red-400/40 bg-red-500/15 px-3 py-1 text-xs font-bold text-red-100">
                En vivo
              </span>
            )}
          </div>
        </div>
        <button className="icon-button h-10 w-10" onClick={onClear} title="Limpiar carrito">
          <Trash2 size={18} />
        </button>
      </div>

      <div className="cart-client-fields mb-2 grid gap-2 lg:grid-cols-[minmax(0,6fr)_minmax(0,4fr)]">
        <div className="relative">
          <input
            className="field-input compact-input"
            placeholder="Buscar o crear cliente"
            value={cliente.nombre}
            onBlur={() => window.setTimeout(() => setIsClientSearchOpen(false), 140)}
            onChange={(event) => updateClientField('nombre', event.target.value)}
            onFocus={() => setIsClientSearchOpen(true)}
          />
          {isClientSearchOpen && clientSuggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 overflow-hidden rounded-[1.4rem] border border-white/10 bg-[#15181c] p-2 shadow-soft">
              {clientSuggestions.map((client) => (
                <button
                  key={client.id}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl border border-transparent px-3 py-3 text-left text-sm text-white hover:border-white/10"
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectClient(client)}
                >
                  <span className="font-semibold">{client.nombre}</span>
                  <span className="text-xs text-zinc-400">{client.telefono || 'Sin teléfono'}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <input
          className="field-input compact-input"
          placeholder="Teléfono"
          value={cliente.telefono}
          onChange={(event) => updateClientField('telefono', event.target.value)}
        />
      </div>

      <div className={`cart-items space-y-2 overflow-y-auto pr-2 ${cart.length === 0 ? 'min-h-[4rem]' : ''}`}>
        {cart.length === 0 && (
          <div className="rounded-[1.5rem] border border-dashed border-white/10 p-6 text-center text-sm text-zinc-500">
            Agrega productos para construir la cotización.
          </div>
        )}
        {cart.map((item) => (
          <div key={item.id} className="cart-item rounded-[1.25rem] border border-white/10 bg-black/20 p-2.5 shadow-insetSoft">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-medium">{item.nombre}</h3>
                <p className="text-xs text-zinc-400">{formatCurrency(item.precio)}</p>
              </div>
              <button className="icon-button h-8 w-8" onClick={() => removeItem(item.id)} title="Quitar producto">
                <XCircle size={17} />
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center gap-2 rounded-full bg-black/30 p-1">
                <button className="qty-button" onClick={() => updateQuantity(item.id, item.cantidad - 1)}>
                  <Minus size={15} />
                </button>
                <input
                  className="qty-input bg-transparent text-center text-sm outline-none"
                  type="number"
                  min="1"
                  value={item.cantidad}
                  onChange={(event) => updateQuantity(item.id, event.target.value)}
                />
                <button className="qty-button" onClick={() => updateQuantity(item.id, item.cantidad + 1)}>
                  <Plus size={15} />
                </button>
              </div>
              <label className="flex items-center gap-1 rounded-full bg-black/25 px-2 py-1 text-xs text-zinc-400">
                Desc.
                <input
                  className="w-10 bg-transparent text-center text-white outline-none"
                  type="number"
                  min="0"
                  max={item.descuento_maximo || 0}
                  value={item.descuento_aplicado || 0}
                  onChange={(event) => updateDiscount(item.id, event.target.value)}
                />
                %
              </label>
              <p className="font-semibold text-sky-100">{formatCurrency(item.subtotal)}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="cart-total mt-2 rounded-[1.45rem] border border-white/10 bg-white/[0.06] p-3">
        <div className="flex items-end justify-between">
          <span className="text-zinc-400">Total</span>
          <strong className="cart-total-value font-display text-[1.9rem] text-white">{formatCurrency(total)}</strong>
        </div>
        <div className="cart-actions mt-3 grid grid-cols-2 gap-2">
          <button className="soft-button" onClick={onShow}>
            <Send size={18} /> Mostrar
          </button>
          <button className="soft-button" onClick={onSave}>
            <Save size={18} /> Cotizar
          </button>
          <button className="soft-button" onClick={onConfirm}>
            <Save size={18} /> Vender
          </button>
          <button className="ghost-button" onClick={onPrint}>
            <Printer size={18} /> PDF
          </button>
        </div>
      </div>
    </GlassCard>
  );
}
