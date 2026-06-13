import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { FolderPlus, Plus, Search, Tags } from 'lucide-react';
import GlassCard from '../components/GlassCard.jsx';
import ProductCard from '../components/ProductCard.jsx';
import ProductForm from '../components/ProductForm.jsx';
import { productService } from '../services/productService.js';
import { categoryService } from '../services/categoryService.js';

const getArrayData = (response) => Array.isArray(response?.data) ? response.data : [];

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [productResponse, categoryResponse] = await Promise.all([
        productService.getAll(selectedCategory ? { categoria: selectedCategory } : {}),
        categoryService.getAll()
      ]);
      setProducts(getArrayData(productResponse));
      setCategories(getArrayData(categoryResponse));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedCategory]);

  const filteredProducts = useMemo(
    () => products.filter((product) => String(product.nombre || '').toLowerCase().includes(search.toLowerCase())),
    [products, search]
  );

  const saveProduct = async (payload) => {
    try {
      if (editing) {
        await productService.update(editing.id, payload);
        toast.success('Producto actualizado');
      } else {
        await productService.create(payload);
        toast.success('Producto creado');
      }
      setEditing(null);
      setShowForm(false);
      await loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const toggleProduct = async (product) => {
    try {
      await productService.setStatus(product.id, !product.activo);
      toast.success(product.activo ? 'Producto desactivado' : 'Producto activado');
      await loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const saveCategory = async (event) => {
    event.preventDefault();
    if (!categoryName.trim()) return;
    try {
      if (editingCategory) {
        await categoryService.update(editingCategory.id, { nombre: categoryName });
        toast.success('Categoría actualizada');
      } else {
        await categoryService.create({ nombre: categoryName });
        toast.success('Categoría creada');
      }
      setCategoryName('');
      setEditingCategory(null);
      await loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const removeCategory = async (category) => {
    try {
      await categoryService.remove(category.id);
      toast.success('Categoría eliminada');
      await loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="management-layout grid gap-5 lg:grid-cols-[1fr_360px]">
      <section className="space-y-5">
        <GlassCard className="management-toolbar flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="field-label flex-1">
            Buscar
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
              <input className="field-input with-icon" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre del producto" />
            </div>
          </label>
          <label className="field-label min-w-56">
            Categoría
            <select className="field-input" value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)}>
              <option value="">Todas</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.nombre}</option>
              ))}
            </select>
          </label>
          <button className="management-primary-action soft-button h-12" onClick={() => { setEditing(null); setShowForm(true); }}>
            <Plus size={18} /> Producto
          </button>
        </GlassCard>

        {loading ? <GlassCard>Cargando productos...</GlassCard> : (
          <div className="products-grid content-grid grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onEdit={(item) => { setEditing(item); setShowForm(true); }}
                onToggle={toggleProduct}
              />
            ))}
          </div>
        )}
      </section>

      <aside className="management-aside space-y-5">
        {showForm && (
          <GlassCard className="management-form-card">
            <h2 className="management-card-title mb-4 text-xl font-semibold">{editing ? 'Editar producto' : 'Crear producto'}</h2>
            <ProductForm product={editing} categories={categories} onSubmit={saveProduct} onCancel={() => { setShowForm(false); setEditing(null); }} />
          </GlassCard>
        )}

        <GlassCard className="category-card">
          <div className="mb-4 flex items-center gap-2">
            <Tags size={19} />
            <h2 className="management-card-title text-xl font-semibold">Categorías</h2>
          </div>
          <form onSubmit={saveCategory} className="category-form mb-4 flex gap-2">
            <input className="field-input" value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="Nueva categoría" />
            <button className="icon-button h-12 w-12" type="submit" title="Guardar categoría">
              <FolderPlus size={18} />
            </button>
          </form>
          <div className="category-list space-y-2">
            {categories.map((category) => (
              <div key={category.id} className="category-row flex items-center justify-between rounded-full bg-black/25 px-4 py-2 text-sm">
                <span>{category.nombre}</span>
                <div className="flex gap-2 text-xs">
                  <button className="text-sky-200" onClick={() => { setEditingCategory(category); setCategoryName(category.nombre); }}>Editar</button>
                  <button className="text-zinc-400" onClick={() => removeCategory(category)}>Eliminar</button>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </aside>
    </div>
  );
}
