import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Search } from 'lucide-react';
import GlassCard from '../components/GlassCard.jsx';
import ProductCard from '../components/ProductCard.jsx';
import CartPanel from '../components/CartPanel.jsx';
import { productService } from '../services/productService.js';
import { categoryService } from '../services/categoryService.js';
import { clientService } from '../services/clientService.js';
import { quoteService } from '../services/quoteService.js';
import { socket } from '../config/socket.js';

const SCREEN_ID = 'pantalla-1';

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
      setProducts(productResponse.data);
      setCategories(categoryResponse.data);
      setClients(clientResponse.data);
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
      const matchesSearch = product.nombre.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = category ? String(product.Categoria_id) === String(category) : true;
      return matchesSearch && matchesCategory;
    }),
    [products, search, category]
  );

  const clientSuggestions = useMemo(() => {
    const term = `${cliente.nombre} ${cliente.telefono}`.trim().toLowerCase();
    if (term.length < 2) return [];

    return clients
      .filter((client) => `${client.nombre} ${client.telefono || ''}`.toLowerCase().includes(term))
      .slice(0, 6);
  }, [clients, cliente.nombre, cliente.telefono]);

  const total = useMemo(() => cart.reduce((sum, item) => sum + Number(item.precio) * Number(item.cantidad), 0), [cart]);

  useEffect(() => {
    if (!isScreenLive) return undefined;

    const timer = window.setTimeout(() => {
      if (cart.length === 0) {
        socket.emit('quote:clear', { screenId: SCREEN_ID });
        return;
      }

      socket.emit('quote:show', {
        screenId: SCREEN_ID,
        cliente,
        items: cart.map((item) => ({
          nombre_producto: item.nombre,
          precio_unitario: Number(item.precio),
          cantidad: Number(item.cantidad),
          subtotal: Number(item.precio) * Number(item.cantidad)
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
        return current.map((item) => item.id === product.id ? { ...item, cantidad: item.cantidad + 1 } : item);
      }
      return [...current, { ...product, cantidad: 1 }];
    });
  };

  const updateQuantity = (id, quantity) => {
    const nextQuantity = Math.max(1, Number(quantity) || 1);
    setCart((current) => current.map((item) => item.id === id ? { ...item, cantidad: nextQuantity } : item));
  };

  const removeItem = (id) => setCart((current) => current.filter((item) => item.id !== id));

  const quoteForScreen = () => ({
    screenId: SCREEN_ID,
    cliente,
    items: cart.map((item) => ({
      nombre_producto: item.nombre,
      precio_unitario: Number(item.precio),
      cantidad: Number(item.cantidad),
      subtotal: Number(item.precio) * Number(item.cantidad)
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
    return true;
  };

  const showOnScreen = () => {
    if (!ensureValidQuote()) return;
    socket.emit('quote:show', quoteForScreen());
    setIsScreenLive(true);
    toast.success('Cotización en vivo en pantalla');
  };

  const clearScreen = () => {
    socket.emit('quote:clear', { screenId: SCREEN_ID });
    setIsScreenLive(false);
    toast.success('Pantalla cliente limpiada');
  };

  const saveQuote = async () => {
    if (!ensureValidQuote()) return;
    const toastId = toast.loading('Guardando cotización...');
    try {
      await quoteService.create({
        cliente,
        items: cart.map((item) => ({
          Producto_id: item.id,
          cantidad: Number(item.cantidad)
        }))
      });
      toast.success('Cotización guardada', { id: toastId });
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
        subtotal: Number(item.precio) * Number(item.cantidad)
      })),
      total,
      fecha: new Date().toISOString()
    }));
    toast.success('Boleta lista para PDF');
    window.open('/cotizacion/imprimir', '_blank', 'noopener,noreferrer');
  };

  const clearCart = () => {
    setCart([]);
    setCliente({ nombre: '', telefono: '' });
    if (isScreenLive) {
      socket.emit('quote:clear', { screenId: SCREEN_ID });
    }
    toast.success('Carrito limpio');
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_390px]">
      <section className="space-y-5">
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
          <div className="max-h-[calc(100vh-25rem)] min-h-[18rem] overflow-y-auto rounded-[2rem] pr-2 pb-28">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
        removeItem={removeItem}
        onShow={showOnScreen}
        onSave={saveQuote}
        onPrint={printQuote}
        onClear={clearCart}
        onClearScreen={clearScreen}
        isScreenLive={isScreenLive}
      />
    </div>
  );
}
