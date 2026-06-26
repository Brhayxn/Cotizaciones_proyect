import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { History, Search } from 'lucide-react';
import GlassCard from '../components/GlassCard.jsx';
import ProductCard from '../components/ProductCard.jsx';
import CartPanel from '../components/CartPanel.jsx';
import RecentSalesModal from '../components/RecentSalesModal.jsx';
import ListLimitHint from '../components/ListLimitHint.jsx';
import { productService } from '../services/productService.js';
import { categoryService } from '../services/categoryService.js';
import { clientService } from '../services/clientService.js';
import { saleService } from '../services/saleService.js';
import { socket } from '../config/socket.js';
import {
  calculateItemSubtotal,
  calculatePaymentTotals,
  calculateQuoteTotal,
  clampDiscount,
  clampQuantity
} from '../utils/quoteCalculations.js';
import { useDebouncedValue } from '../hooks/useDebouncedValue.js';

const SCREEN_ID = 'pantalla-1';
const getArrayData = (response) => Array.isArray(response?.data) ? response.data : [];
const PRINT_FRAME_ID = 'quote-print-frame';

export default function QuotePage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [clients, setClients] = useState([]);
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [cliente, setCliente] = useState({ nombre: '', telefono: '' });
  const [loading, setLoading] = useState(true);
  const [isScreenLive, setIsScreenLive] = useState(false);
  const [isRecentSalesOpen, setIsRecentSalesOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [productMeta, setProductMeta] = useState(null);
  const productRequestId = useRef(0);
  const clientRequestId = useRef(0);
  const cartRef = useRef([]);
  const debouncedSearch = useDebouncedValue(search);
  const clientTerm = cliente.nombre.trim() || cliente.telefono.trim();
  const debouncedClientTerm = useDebouncedValue(clientTerm);

  const loadProducts = async () => {
    const currentRequest = ++productRequestId.current;
    setLoading(true);
    try {
      const productResponse = await productService.getAll({
        activo: true,
        ...(debouncedSearch.trim() ? { q: debouncedSearch.trim() } : {}),
        ...(category ? { categoria: category } : {})
      });
      if (currentRequest !== productRequestId.current) return;
      setProducts(getArrayData(productResponse));
      setProductMeta(productResponse.meta || null);
    } catch (err) {
      if (currentRequest === productRequestId.current) toast.error(err.message);
    } finally {
      if (currentRequest === productRequestId.current) setLoading(false);
    }
  };

  useEffect(() => {
    categoryService.getAll()
      .then((response) => setCategories(getArrayData(response)))
      .catch((err) => toast.error(err.message));
  }, []);

  useEffect(() => {
    loadProducts();
  }, [debouncedSearch, category]);

  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  useEffect(() => {
    const handleStockUpdate = (payload = {}) => {
      const updates = Array.isArray(payload.products) ? payload.products : [];
      if (updates.length === 0) return;

      const updatesById = new Map(updates.map((product) => [Number(product.id), product]));
      setProducts((current) => current.map((product) => {
        const update = updatesById.get(Number(product.id));
        return update ? { ...product, stock: Number(update.stock), activo: update.activo } : product;
      }));

      const unavailable = [];
      const reduced = [];
      const affected = [];
      const nextCart = [];

      for (const item of cartRef.current) {
        const update = updatesById.get(Number(item.id));
        if (!update) {
          nextCart.push(item);
          continue;
        }

        const nextStock = Math.max(0, Number(update.stock) || 0);
        affected.push(update.nombre || item.nombre);
        if (nextStock === 0 || update.activo === false) {
          unavailable.push(update.nombre || item.nombre);
          continue;
        }

        const nextQuantity = Math.min(Number(item.cantidad), nextStock);
        if (nextQuantity < Number(item.cantidad)) reduced.push(update.nombre || item.nombre);
        const nextItem = { ...item, stock: nextStock, cantidad: nextQuantity };
        nextCart.push({ ...nextItem, subtotal: calculateItemSubtotal(nextItem) });
      }

      if (affected.length === 0) return;
      cartRef.current = nextCart;
      setCart(nextCart);

      if (unavailable.length > 0) {
        toast.error(`${unavailable.join(', ')} quedo sin stock y se retiro del carrito`);
      } else if (reduced.length > 0) {
        toast.error(`Stock actualizado: se ajusto la cantidad de ${reduced.join(', ')}`);
      } else if (payload.reason === 'anulacion' || payload.reason === 'abastecimiento') {
        toast.success(`Stock actualizado: ${affected.join(', ')}`);
      } else {
        toast(`Otro vendedor actualizo el stock de ${affected.join(', ')}`);
      }
    };

    socket.on('inventory:stock', handleStockUpdate);
    return () => socket.off('inventory:stock', handleStockUpdate);
  }, []);

  useEffect(() => {
    const handleReconnect = () => loadProducts();
    socket.on('connect', handleReconnect);
    return () => socket.off('connect', handleReconnect);
  }, [debouncedSearch, category]);

  useEffect(() => {
    const term = debouncedClientTerm.trim();
    const currentRequest = ++clientRequestId.current;
    if (term.length < 2) {
      setClients([]);
      return;
    }

    clientService.getAll({ q: term, limit: 6 })
      .then((response) => {
        if (currentRequest === clientRequestId.current) setClients(getArrayData(response));
      })
      .catch((err) => {
        if (currentRequest === clientRequestId.current) toast.error(err.message);
      });
  }, [debouncedClientTerm]);

  const unroundedTotal = useMemo(() => calculateQuoteTotal(cart), [cart]);
  const paymentTotals = useMemo(
    () => calculatePaymentTotals(unroundedTotal, paymentMethod),
    [unroundedTotal, paymentMethod]
  );
  const total = paymentTotals.finalTotal;

  useEffect(() => {
    if (!isScreenLive) return undefined;

    const timer = window.setTimeout(() => {
      if (cart.length === 0) {
        socket.emit('sale:clear', { screenId: SCREEN_ID });
        return;
      }

      socket.emit('sale:show', {
        screenId: SCREEN_ID,
        cliente,
        metodo_pago: paymentMethod || null,
        total_sin_redondeo: paymentTotals.unroundedTotal,
        ajuste_redondeo: paymentTotals.roundingAdjustment,
        items: cart.map((item) => ({
          nombre_producto: item.nombre,
          precio_unitario: Number(item.precio),
          cantidad: Number(item.cantidad),
          descuento_aplicado: Number(item.descuento_aplicado) || 0,
          subtotal: calculateItemSubtotal(item)
        })),
        total
      });
    }, 180);

    return () => window.clearTimeout(timer);
  }, [cart, cliente, total, isScreenLive, paymentMethod, paymentTotals]);

  const addToCart = (product) => {
    setCart((current) => {
      const exists = current.find((item) => item.id === product.id);
      if (exists) {
        const updatedItem = {
          ...exists,
          cantidad: Math.min(Number(exists.stock) || 0, exists.cantidad + 1)
        };
        updatedItem.subtotal = calculateItemSubtotal(updatedItem);
        return [...current.filter((item) => item.id !== product.id), updatedItem];
      }
      return [...current, { ...product, cantidad: 1, descuento_aplicado: 0, subtotal: Number(product.precio) || 0 }];
    });
  };

  const updateQuantity = (id, quantity) => {
    setCart((current) => current.map((item) => {
      if (item.id !== id) return item;
      const nextQuantity = clampQuantity(quantity, item.stock);
      const nextItem = { ...item, cantidad: nextQuantity };
      return { ...nextItem, subtotal: calculateItemSubtotal(nextItem) };
    }));
  };

  const updateDiscount = (id, discount) => {
    setCart((current) => current.map((item) => {
      if (item.id !== id) return item;
      const nextDiscount = clampDiscount(discount, item.descuento_maximo);
      const nextItem = { ...item, descuento_aplicado: nextDiscount };
      return { ...nextItem, subtotal: calculateItemSubtotal(nextItem) };
    }));
  };

  const removeItem = (id) => setCart((current) => current.filter((item) => item.id !== id));

  const quoteForScreen = () => ({
    screenId: SCREEN_ID,
    cliente,
    metodo_pago: paymentMethod || null,
    total_sin_redondeo: paymentTotals.unroundedTotal,
    ajuste_redondeo: paymentTotals.roundingAdjustment,
    items: cart.map((item) => ({
      nombre_producto: item.nombre,
      precio_unitario: Number(item.precio),
      cantidad: Number(item.cantidad),
      descuento_aplicado: Number(item.descuento_aplicado) || 0,
      subtotal: calculateItemSubtotal(item)
    })),
    total
  });

  const ensureValidQuote = () => {
    if (!cliente.nombre.trim()) {
      toast.error('Ingresa el nombre del cliente');
      return false;
    }
    if (cart.length === 0) {
      toast.error('Agrega al menos un producto');
      return false;
    }
    const withoutStock = cart.find((item) => Number(item.cantidad) > Number(item.stock));
    if (withoutStock) {
      toast.error(`Stock insuficiente para ${withoutStock.nombre}`);
      return false;
    }
    return true;
  };

  const showOnScreen = () => {
    if (!ensureValidQuote()) return;
    socket.emit('sale:show', quoteForScreen());
    setIsScreenLive(true);
    toast.success('Cotización en vivo en pantalla');
  };

  const buildSalePayload = (estado = 'cotizada') => ({
    estado,
    cliente,
    socket_id: socket.id || null,
    ...(estado === 'confirmada' ? { metodo_pago: paymentMethod } : {}),
    items: cart.map((item) => ({
      Producto_id: item.id,
      cantidad: Number(item.cantidad),
      descuento_aplicado: Number(item.descuento_aplicado) || 0
    }))
  });

  const saveQuote = async () => {
    if (!ensureValidQuote()) return;
    const toastId = toast.loading('Guardando cotización...');
    try {
      await saleService.create(buildSalePayload('cotizada'));
      toast.success('Cotización guardada', { id: toastId });
    } catch (err) {
      toast.error(err.message, { id: toastId });
    }
  };

  const reconcileCartStock = async () => {
    const currentCart = cartRef.current;
    if (currentCart.length === 0) return;

    const responses = await Promise.allSettled(
      currentCart.map((item) => productService.getById(item.id))
    );
    const snapshots = responses
      .filter((result) => result.status === 'fulfilled' && result.value?.data)
      .map((result) => result.value.data);

    if (snapshots.length === 0) {
      await loadProducts();
      return;
    }

    const snapshotsById = new Map(snapshots.map((product) => [Number(product.id), product]));
    setProducts((current) => current.map((product) => {
      const snapshot = snapshotsById.get(Number(product.id));
      return snapshot ? { ...product, ...snapshot, stock: Number(snapshot.stock) } : product;
    }));

    const nextCart = currentCart.flatMap((item) => {
      const snapshot = snapshotsById.get(Number(item.id));
      if (!snapshot) return [item];
      const nextStock = Math.max(0, Number(snapshot.stock) || 0);
      if (nextStock === 0 || snapshot.activo === false) return [];
      const nextItem = {
        ...item,
        stock: nextStock,
        activo: snapshot.activo,
        cantidad: Math.min(Number(item.cantidad), nextStock)
      };
      return [{ ...nextItem, subtotal: calculateItemSubtotal(nextItem) }];
    });
    cartRef.current = nextCart;
    setCart(nextCart);
  };

  const confirmSale = async () => {
    if (!ensureValidQuote()) return;
    if (!paymentMethod) {
      toast.error('Selecciona un método de pago');
      return;
    }
    const toastId = toast.loading('Confirmando venta...');
    try {
      await saleService.create(buildSalePayload('confirmada'));
      toast.success('Venta confirmada y stock descontado', { id: toastId });
      setCart([]);
      setPaymentMethod('');
      await loadProducts();
    } catch (err) {
      if (/stock insuficiente/i.test(err.message)) await reconcileCartStock();
      toast.error(err.message, { id: toastId });
    }
  };

  const printQuote = () => {
    if (!ensureValidQuote()) return;
    localStorage.setItem('printableQuote', JSON.stringify({
      cliente,
      metodo_pago: paymentMethod || null,
      items: cart.map((item) => ({
        id: item.id,
        nombre: item.nombre,
        precio: Number(item.precio),
        cantidad: Number(item.cantidad),
        descuento_aplicado: Number(item.descuento_aplicado) || 0,
        subtotal: calculateItemSubtotal(item)
      })),
      total,
      total_sin_redondeo: paymentTotals.unroundedTotal,
      ajuste_redondeo: paymentTotals.roundingAdjustment,
      fecha: new Date().toISOString()
    }));

    const previousFrame = document.getElementById(PRINT_FRAME_ID);
    previousFrame?.remove();

    const frame = document.createElement('iframe');
    frame.id = PRINT_FRAME_ID;
    frame.title = 'Cotización para imprimir';
    frame.src = `/cotizacion/imprimir?ts=${Date.now()}`;
    frame.style.position = 'fixed';
    frame.style.right = '0';
    frame.style.bottom = '0';
    frame.style.width = '1px';
    frame.style.height = '1px';
    frame.style.border = '0';
    frame.style.opacity = '0';
    frame.style.pointerEvents = 'none';

    const removeFrame = () => window.setTimeout(() => frame.remove(), 800);
    frame.addEventListener('load', () => {
      frame.contentWindow?.addEventListener('afterprint', removeFrame, { once: true });
      window.setTimeout(removeFrame, 60000);
    }, { once: true });

    document.body.appendChild(frame);
    toast.success('Cotización lista para PDF');
  };

  const clearCart = () => {
    setCart([]);
    setCliente({ nombre: '', telefono: '' });
    setPaymentMethod('');
    if (isScreenLive) {
      socket.emit('sale:clear', { screenId: SCREEN_ID });
      setIsScreenLive(false);
    }
    toast.success('Carrito limpio');
  };

  return (
    <div className="quote-layout grid gap-5 lg:grid-cols-[minmax(0,1fr)_350px] xl:grid-cols-[minmax(0,1fr)_390px]">
      <section className="quote-main space-y-5">
        <GlassCard className="grid gap-3 md:grid-cols-[1fr_220px_auto] md:items-end">
          <label className="field-label">
            Buscar productos
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
              <input className="field-input with-icon" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre del producto" />
            </div>
          </label>
          <label className="field-label">
            Categoría
            <select className="field-input" value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="">Todas</option>
              {categories.map((item) => (
                <option key={item.id} value={item.id}>{item.nombre}</option>
              ))}
            </select>
          </label>
          <button className="ghost-button h-12 px-5" type="button" onClick={() => setIsRecentSalesOpen(true)}>
            <History size={18} /> Ventas
          </button>
        </GlassCard>

        {loading ? <GlassCard>Cargando productos activos...</GlassCard> : (
          <div className="quote-products-scroll overflow-y-auto rounded-[1.35rem] pb-4 pr-2 sm:rounded-[2rem]">
            <div className="quote-products-grid grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} onAdd={addToCart} compact />
              ))}
            </div>
            <div className="mt-3">
              <ListLimitHint meta={productMeta} />
            </div>
          </div>
        )}
      </section>

      <CartPanel
        cart={cart}
        total={total}
        unroundedTotal={paymentTotals.unroundedTotal}
        roundingAdjustment={paymentTotals.roundingAdjustment}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        cliente={cliente}
        setCliente={setCliente}
        clientSuggestions={clients}
        updateQuantity={updateQuantity}
        updateDiscount={updateDiscount}
        removeItem={removeItem}
        onShow={showOnScreen}
        onSave={saveQuote}
        onConfirm={confirmSale}
        onPrint={printQuote}
        onClear={clearCart}
        isScreenLive={isScreenLive}
      />

      <RecentSalesModal
        open={isRecentSalesOpen}
        onClose={() => setIsRecentSalesOpen(false)}
        onChanged={loadProducts}
      />
    </div>
  );
}
