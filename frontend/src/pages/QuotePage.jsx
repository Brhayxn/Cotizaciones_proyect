import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Search } from 'lucide-react';
import GlassCard from '../components/GlassCard.jsx';
import ProductCard from '../components/ProductCard.jsx';
import CartPanel from '../components/CartPanel.jsx';
import { productService } from '../services/productService.js';
import { categoryService } from '../services/categoryService.js';
import { clientService } from '../services/clientService.js';
import { saleService } from '../services/saleService.js';
import { socket } from '../config/socket.js';

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

  const loadData = async () => {
    setLoading(true);
    try {
      const [productResponse, categoryResponse, clientResponse] = await Promise.all([
        productService.getAll({ activo: true }),
        categoryService.getAll(),
        clientService.getAll()
      ]);
      setProducts(getArrayData(productResponse));
      setCategories(getArrayData(categoryResponse));
      setClients(getArrayData(clientResponse));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredProducts = useMemo(
    () => products.filter((product) => {
      const matchesSearch = String(product.nombre || '').toLowerCase().includes(search.toLowerCase());
      const matchesCategory = category ? String(product.Categoria_id) === String(category) : true;
      return matchesSearch && matchesCategory;
    }),
    [products, search, category]
  );

  const clientSuggestions = useMemo(() => {
    const term = `${cliente.nombre} ${cliente.telefono}`.trim().toLowerCase();
    if (term.length < 2) return [];

    return clients
      .filter((client) => `${client.nombre || ''} ${client.telefono || ''}`.toLowerCase().includes(term))
      .slice(0, 6);
  }, [clients, cliente.nombre, cliente.telefono]);

  const calculateItemSubtotal = (item) => {
    const precio = Number(item.precio) || 0;
    const cantidad = Number(item.cantidad) || 0;
    const descuento = Number(item.descuento_aplicado) || 0;
    return Math.round(precio * cantidad * ((100 - descuento) / 100));
  };

  const total = useMemo(() => cart.reduce((sum, item) => sum + calculateItemSubtotal(item), 0), [cart]);

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
  }, [cart, cliente, total, isScreenLive]);

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
      const maxStock = Number(item.stock) || 1;
      const nextQuantity = Math.min(maxStock, Math.max(1, Number(quantity) || 1));
      const nextItem = { ...item, cantidad: nextQuantity };
      return { ...nextItem, subtotal: calculateItemSubtotal(nextItem) };
    }));
  };

  const updateDiscount = (id, discount) => {
    setCart((current) => current.map((item) => {
      if (item.id !== id) return item;
      const maxDiscount = Number(item.descuento_maximo) || 0;
      const nextDiscount = Math.min(maxDiscount, Math.max(0, Number(discount) || 0));
      const nextItem = { ...item, descuento_aplicado: nextDiscount };
      return { ...nextItem, subtotal: calculateItemSubtotal(nextItem) };
    }));
  };

  const removeItem = (id) => setCart((current) => current.filter((item) => item.id !== id));

  const quoteForScreen = () => ({
    screenId: SCREEN_ID,
    cliente,
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

  const confirmSale = async () => {
    if (!ensureValidQuote()) return;
    const toastId = toast.loading('Confirmando venta...');
    try {
      await saleService.create(buildSalePayload('confirmada'));
      toast.success('Venta confirmada y stock descontado', { id: toastId });
      setCart([]);
      await loadData();
    } catch (err) {
      toast.error(err.message, { id: toastId });
    }
  };

  const printQuote = () => {
    if (!ensureValidQuote()) return;
    localStorage.setItem('printableQuote', JSON.stringify({
      cliente,
      items: cart.map((item) => ({
        id: item.id,
        nombre: item.nombre,
        precio: Number(item.precio),
        cantidad: Number(item.cantidad),
        descuento_aplicado: Number(item.descuento_aplicado) || 0,
        subtotal: calculateItemSubtotal(item)
      })),
      total,
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
    if (isScreenLive) {
      socket.emit('sale:clear', { screenId: SCREEN_ID });
      setIsScreenLive(false);
    }
    toast.success('Carrito limpio');
  };

  return (
    <div className="quote-layout grid gap-5 lg:grid-cols-[minmax(0,1fr)_350px] xl:grid-cols-[minmax(0,1fr)_390px]">
      <section className="quote-main space-y-5">
        <GlassCard className="grid gap-3 md:grid-cols-[1fr_240px]">
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
        </GlassCard>

        {loading ? <GlassCard>Cargando productos activos...</GlassCard> : (
          <div className="quote-products-scroll overflow-y-auto rounded-[1.35rem] pb-4 pr-2 sm:rounded-[2rem]">
            <div className="quote-products-grid grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} onAdd={addToCart} compact />
              ))}
            </div>
          </div>
        )}
      </section>

      <CartPanel
        cart={cart}
        total={total}
        cliente={cliente}
        setCliente={setCliente}
        clientSuggestions={clientSuggestions}
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
    </div>
  );
}
