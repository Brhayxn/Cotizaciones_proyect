import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Boxes, Filter, PackagePlus, Search } from 'lucide-react';
import GlassCard from '../components/GlassCard.jsx';
import ListLimitHint from '../components/ListLimitHint.jsx';
import { inventoryService } from '../services/inventoryService.js';
import { productService } from '../services/productService.js';
import { useDebouncedValue } from '../hooks/useDebouncedValue.js';

const getArrayData = (response) => Array.isArray(response?.data) ? response.data : [];

const movementLabels = {
  abastecimiento: 'Abastecimiento',
  ajuste: 'Ajuste',
  venta: 'Venta',
  anulacion: 'Anulación'
};

export default function InventoryPage() {
  const [movements, setMovements] = useState([]);
  const [movementType, setMovementType] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [manualProductSearch, setManualProductSearch] = useState('');
  const [manualSuggestions, setManualSuggestions] = useState([]);
  const [isManualSearchOpen, setIsManualSearchOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [movementMeta, setMovementMeta] = useState(null);
  const [summary, setSummary] = useState({ productos: 0, stockTotal: 0, stockBajo: 0 });
  const [form, setForm] = useState({
    Producto_id: '',
    cantidad: '',
    tipo_movimiento: 'abastecimiento'
  });
  const movementRequestId = useRef(0);
  const suggestionRequestId = useRef(0);
  const debouncedProductSearch = useDebouncedValue(productSearch);
  const debouncedManualSearch = useDebouncedValue(manualProductSearch);

  const loadMovements = async () => {
    const currentRequest = ++movementRequestId.current;
    setLoading(true);
    try {
      const movementParams = {};
      if (movementType) movementParams.tipo = movementType;
      if (debouncedProductSearch.trim()) movementParams.q = debouncedProductSearch.trim();

      const movementsResponse = await inventoryService.getMovements(movementParams);
      if (currentRequest !== movementRequestId.current) return;
      setMovements(getArrayData(movementsResponse));
      setMovementMeta(movementsResponse.meta || null);
    } catch (err) {
      if (currentRequest === movementRequestId.current) toast.error(err.message);
    } finally {
      if (currentRequest === movementRequestId.current) setLoading(false);
    }
  };

  useEffect(() => {
    loadMovements();
  }, [movementType, debouncedProductSearch]);

  const loadSummary = async () => {
    try {
      const response = await inventoryService.getSummary();
      setSummary(response.data || { productos: 0, stockTotal: 0, stockBajo: 0 });
    } catch (err) {
      toast.error(err.message);
    }
  };

  useEffect(() => {
    loadSummary();
  }, []);

  useEffect(() => {
    const term = debouncedManualSearch.trim();
    const currentRequest = ++suggestionRequestId.current;
    if (term.length < 2 || form.Producto_id) {
      setManualSuggestions([]);
      return;
    }

    productService.getAll({ q: term, activo: true, limit: 7 })
      .then((response) => {
        if (currentRequest === suggestionRequestId.current) setManualSuggestions(getArrayData(response));
      })
      .catch((err) => {
        if (currentRequest === suggestionRequestId.current) toast.error(err.message);
      });
  }, [debouncedManualSearch, form.Producto_id]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const selectManualProduct = (product) => {
    setForm((current) => ({ ...current, Producto_id: product.id }));
    setManualProductSearch(product.nombre);
    setIsManualSearchOpen(false);
  };

  const saveMovement = async (event) => {
    event.preventDefault();
    if (!form.Producto_id) {
      toast.error('Selecciona un producto');
      return;
    }

    const cantidad = Number(form.cantidad);
    if (!Number.isInteger(cantidad) || cantidad <= 0) {
      toast.error('La cantidad debe ser mayor a 0');
      return;
    }

    const toastId = toast.loading('Actualizando inventario...');
    try {
      await inventoryService.createMovement({
        Producto_id: Number(form.Producto_id),
        cantidad,
        tipo_movimiento: form.tipo_movimiento
      });
      toast.success(form.tipo_movimiento === 'ajuste' ? 'Stock ajustado' : 'Stock abastecido', { id: toastId });
      setForm({ Producto_id: '', cantidad: '', tipo_movimiento: 'abastecimiento' });
      setManualProductSearch('');
      await Promise.all([loadMovements(), loadSummary()]);
    } catch (err) {
      toast.error(err.message, { id: toastId });
    }
  };

  return (
    <div className="inventory-view grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="space-y-5">
        <GlassCard className="grid gap-3 lg:grid-cols-2">
          <label className="field-label">
            Buscar en historial
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
              <input className="field-input with-icon" value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Producto en movimientos" />
            </div>
          </label>
          <label className="field-label">
            Movimiento
            <select className="field-input" value={movementType} onChange={(event) => setMovementType(event.target.value)}>
              <option value="">Todos</option>
              {Object.entries(movementLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
        </GlassCard>

        <GlassCard>
          <div className="mb-4 flex items-center gap-2">
            <Filter size={19} />
            <h2 className="text-xl font-semibold">Historial de inventario</h2>
          </div>
          <div className="max-h-[calc(100vh-20rem)] min-h-[34rem] space-y-3 overflow-y-auto pr-2">
            {loading && <p className="text-sm text-zinc-400">Cargando movimientos...</p>}
            {!loading && movements.length === 0 && <p className="text-sm text-zinc-500">No hay movimientos para los filtros seleccionados.</p>}
            {movements.map((movement) => (
              <article key={movement.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-lg font-semibold">{movement.producto?.nombre || 'Producto'}</p>
                    <p className="mt-1 text-sm text-zinc-500">{new Date(movement.fecha_hora || movement.createdAt).toLocaleString('es-CL')}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-300">
                      {movementLabels[movement.tipo_movimiento] || movement.tipo_movimiento}
                    </span>
                    <span className="rounded-full border border-sky-200/20 px-3 py-1 text-xs font-bold text-sky-100">
                      Cantidad {movement.cantidad}
                    </span>
                  </div>
                </div>
              </article>
            ))}
            {!loading && <ListLimitHint meta={movementMeta} />}
          </div>
        </GlassCard>
      </section>

      <aside className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
          <GlassCard className="p-4">
            <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Productos</p>
            <p className="mt-2 font-display text-3xl font-semibold">{summary.productos}</p>
          </GlassCard>
          <GlassCard className="p-4">
            <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Stock total</p>
            <p className="mt-2 font-display text-3xl font-semibold text-sky-100">{summary.stockTotal}</p>
          </GlassCard>
          <GlassCard className="p-4">
            <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Stock bajo</p>
            <p className={`mt-2 font-display text-3xl font-semibold ${summary.stockBajo > 0 ? 'text-red-200' : 'text-sky-100'}`}>{summary.stockBajo}</p>
          </GlassCard>
        </div>

        <GlassCard>
          <div className="mb-4 flex items-center gap-2">
            <PackagePlus size={19} />
            <h2 className="text-xl font-semibold">Movimiento manual</h2>
          </div>
          <form onSubmit={saveMovement} className="space-y-3">
            <label className="field-label">
              Producto
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                <input
                  className="field-input with-icon"
                  value={manualProductSearch}
                  onBlur={() => window.setTimeout(() => setIsManualSearchOpen(false), 140)}
                  onChange={(event) => {
                    setManualProductSearch(event.target.value);
                    setForm((current) => ({ ...current, Producto_id: '' }));
                    setIsManualSearchOpen(true);
                  }}
                  onFocus={() => setIsManualSearchOpen(true)}
                  placeholder="Buscar producto"
                />
                {isManualSearchOpen && manualSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 overflow-hidden rounded-[1.4rem] border border-white/10 bg-[#15181c] p-2 shadow-soft">
                    {manualSuggestions.map((product) => (
                      <button
                        key={product.id}
                        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-transparent px-3 py-3 text-left text-sm text-white hover:border-white/10"
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => selectManualProduct(product)}
                      >
                        <span className="font-semibold">{product.nombre}</span>
                        <span className="text-xs text-zinc-400">Stock {product.stock}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="field-label">
                Tipo
                <select className="field-input" name="tipo_movimiento" value={form.tipo_movimiento} onChange={handleChange}>
                  <option value="abastecimiento">Abastecimiento</option>
                  <option value="ajuste">Ajuste</option>
                </select>
              </label>
              <label className="field-label">
                Cantidad
                <input className="field-input" name="cantidad" type="number" min="1" value={form.cantidad} onChange={handleChange} />
              </label>
            </div>
            <button className="soft-button w-full" type="submit">
              <Boxes size={18} /> Guardar movimiento
            </button>
          </form>
        </GlassCard>
      </aside>
    </div>
  );
}
