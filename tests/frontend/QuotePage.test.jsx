import '../setup/frontend.mjs';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import QuotePage from '../../frontend/src/pages/QuotePage.jsx';

const mocks = vi.hoisted(() => ({
  productGetAll: vi.fn(),
  productGetById: vi.fn(),
  categoryGetAll: vi.fn(),
  clientGetAll: vi.fn(),
  saleCreate: vi.fn(),
  socketEmit: vi.fn(),
  socketOn: vi.fn(),
  socketOff: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  toastLoading: vi.fn(() => 'toast-id')
}));

vi.mock('../../frontend/src/services/productService.js', () => ({
  productService: { getAll: mocks.productGetAll, getById: mocks.productGetById }
}));
vi.mock('../../frontend/src/services/categoryService.js', () => ({ categoryService: { getAll: mocks.categoryGetAll } }));
vi.mock('../../frontend/src/services/clientService.js', () => ({ clientService: { getAll: mocks.clientGetAll } }));
vi.mock('../../frontend/src/services/saleService.js', () => ({
  saleService: { create: mocks.saleCreate, getAll: vi.fn(), getToday: vi.fn(), cancel: vi.fn(), confirm: vi.fn(), remove: vi.fn() }
}));
vi.mock('../../frontend/src/config/socket.js', () => ({
  socket: { id: 'vendedor-test', emit: mocks.socketEmit, on: mocks.socketOn, off: mocks.socketOff }
}));
vi.mock('react-hot-toast', () => ({
  default: {
    error: mocks.toastError,
    success: mocks.toastSuccess,
    loading: mocks.toastLoading
  }
}));

const products = [
  { id: 1, nombre: 'Martillo Azul', precio: 10000, stock: 5, descuento_maximo: 10, activo: true, Categoria_id: 1, categoria: { nombre: 'Herramientas' } },
  { id: 2, nombre: 'Tabla Pino', precio: 5000, stock: 3, descuento_maximo: 5, activo: true, Categoria_id: 2, categoria: { nombre: 'Maderas' } }
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.productGetAll.mockImplementation(async (params = {}) => ({
    data: products.filter((product) => {
      const matchesSearch = params.q ? product.nombre.toLowerCase().includes(params.q.toLowerCase()) : true;
      const matchesCategory = params.categoria ? String(product.Categoria_id) === String(params.categoria) : true;
      return matchesSearch && matchesCategory;
    }),
    meta: { limit: 40, total: products.length, hasMore: false }
  }));
  mocks.categoryGetAll.mockResolvedValue({ data: [{ id: 1, nombre: 'Herramientas' }, { id: 2, nombre: 'Maderas' }] });
  mocks.clientGetAll.mockResolvedValue({ data: [] });
  mocks.productGetById.mockImplementation(async (id) => ({ data: products.find((product) => product.id === id) }));
  mocks.saleCreate.mockResolvedValue({ data: { id: 1 } });
});

describe('QuotePage', () => {
  it('carga, busca y filtra productos', async () => {
    const user = userEvent.setup();
    render(<QuotePage />);
    expect(await screen.findByText('Martillo Azul')).toBeInTheDocument();
    expect(screen.getByText('Tabla Pino')).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Nombre del producto'), 'martillo');
    await waitFor(() => expect(screen.queryByText('Tabla Pino')).not.toBeInTheDocument());
    expect(mocks.productGetAll).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'martillo' }));

    await user.clear(screen.getByPlaceholderText('Nombre del producto'));
    await user.selectOptions(screen.getByRole('combobox'), '2');
    await waitFor(() => expect(screen.queryByText('Martillo Azul')).not.toBeInTheDocument());
    expect(await screen.findByText('Tabla Pino')).toBeInTheDocument();
  });

  it('agrega al carrito, limita cantidad/descuento y confirma una venta', async () => {
    const user = userEvent.setup();
    render(<QuotePage />);
    await screen.findByText('Martillo Azul');
    await user.click(screen.getAllByRole('button', { name: /agregar/i })[0]);
    await user.type(screen.getByPlaceholderText(/buscar o crear cliente/i), 'Cliente UI');

    const quantity = screen.getAllByRole('spinbutton')[0];
    await user.clear(quantity);
    await user.type(quantity, '99');
    expect(quantity).toHaveValue(5);

    const discount = screen.getAllByRole('spinbutton')[1];
    await user.clear(discount);
    await user.type(discount, '99');
    expect(discount).toHaveValue(10);

    await user.click(screen.getByRole('button', { name: /transferencia/i }));
    await user.click(screen.getByRole('button', { name: /vender/i }));
    await waitFor(() => expect(mocks.saleCreate).toHaveBeenCalled());
    expect(mocks.saleCreate.mock.calls[0][0]).toMatchObject({
      estado: 'confirmada',
      metodo_pago: 'transferencia',
      items: [{ Producto_id: 1, cantidad: 5, descuento_aplicado: 10 }]
    });
  });

  it('exige método de pago y previsualiza el redondeo en efectivo', async () => {
    mocks.productGetAll.mockResolvedValueOnce({
      data: [{ ...products[0], precio: 12325, descuento_maximo: 0 }]
    });
    const user = userEvent.setup();
    render(<QuotePage />);
    await screen.findByText('Martillo Azul');
    await user.click(screen.getByRole('button', { name: /agregar/i }));
    await user.type(screen.getByPlaceholderText(/buscar o crear cliente/i), 'Cliente efectivo');

    await user.click(screen.getByRole('button', { name: /vender/i }));
    expect(mocks.toastError).toHaveBeenCalledWith('Selecciona un método de pago');

    await user.click(screen.getByRole('button', { name: /efectivo/i }));
    expect(screen.getByText('Total previo').parentElement).toHaveTextContent('12.325');
    expect(screen.getByText('Total final').parentElement).toHaveTextContent('12.320');

    await user.click(screen.getByRole('button', { name: /vender/i }));
    await waitFor(() => expect(mocks.saleCreate).toHaveBeenCalledWith(expect.objectContaining({
      estado: 'confirmada',
      metodo_pago: 'efectivo'
    })));
  });

  it('informa errores de carga y valida acciones sin datos', async () => {
    mocks.productGetAll.mockRejectedValueOnce(new Error('API caída'));
    render(<QuotePage />);
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith('API caída'));

    await userEvent.click(screen.getByRole('button', { name: /cotizar/i }));
    expect(mocks.toastError).toHaveBeenCalledWith('Ingresa el nombre del cliente');
  });

  it('emite la cotización y su limpieza por Socket.io', async () => {
    const user = userEvent.setup();
    render(<QuotePage />);
    await screen.findByText('Martillo Azul');
    await user.click(screen.getAllByRole('button', { name: /agregar/i })[0]);
    await user.type(screen.getByPlaceholderText(/buscar o crear cliente/i), 'Cliente socket');
    await user.click(screen.getByRole('button', { name: /mostrar/i }));
    expect(mocks.socketEmit).toHaveBeenCalledWith('sale:show', expect.objectContaining({ screenId: 'pantalla-1' }));

    await user.click(screen.getByTitle('Limpiar carrito'));
    expect(mocks.socketEmit).toHaveBeenCalledWith('sale:clear', { screenId: 'pantalla-1' });
  });

  it('ajusta el carrito cuando otro vendedor reduce el stock', async () => {
    const user = userEvent.setup();
    render(<QuotePage />);
    await screen.findByText('Martillo Azul');
    await user.click(screen.getAllByRole('button', { name: /agregar/i })[0]);
    await user.click(screen.getAllByRole('button', { name: /agregar/i })[0]);

    const stockHandler = mocks.socketOn.mock.calls
      .find(([event]) => event === 'inventory:stock')?.[1];
    expect(stockHandler).toBeTypeOf('function');

    act(() => stockHandler({
      reason: 'venta',
      products: [{ id: 1, nombre: 'Martillo Azul', stock: 1, activo: true }]
    }));

    expect(screen.getAllByRole('spinbutton')[0]).toHaveValue(1);
    expect(mocks.toastError).toHaveBeenCalledWith(expect.stringContaining('se ajusto la cantidad'));
  });

  it('reconcilia las cards cuando la venta falla por stock insuficiente', async () => {
    mocks.saleCreate.mockRejectedValueOnce(new Error('Stock insuficiente para confirmar la venta'));
    mocks.productGetById.mockResolvedValueOnce({ data: { ...products[0], stock: 0 } });
    const user = userEvent.setup();
    render(<QuotePage />);
    await screen.findByText('Martillo Azul');
    await user.click(screen.getAllByRole('button', { name: /agregar/i })[0]);
    await user.type(screen.getByPlaceholderText(/buscar o crear cliente/i), 'Cliente sin stock');
    await user.click(screen.getByRole('button', { name: /transferencia/i }));
    await user.click(screen.getByRole('button', { name: /vender/i }));

    await waitFor(() => expect(mocks.productGetById).toHaveBeenCalledWith(1));
    expect(await screen.findByText('Stock 0')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sin stock/i })).toBeDisabled();
    expect(mocks.toastError).toHaveBeenCalledWith(
      'Stock insuficiente para confirmar la venta',
      { id: 'toast-id' }
    );
  });
});
