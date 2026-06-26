import '../setup/frontend.mjs';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import CartPanel from '../../frontend/src/components/CartPanel.jsx';

const makeProps = () => ({
  cart: [{
    id: 1,
    nombre: 'Martillo de prueba',
    precio: 10000,
    cantidad: 2,
    stock: 5,
    descuento_maximo: 10,
    descuento_aplicado: 0,
    subtotal: 20000
  }],
  total: 20000,
  cliente: { nombre: '', telefono: '' },
  setCliente: vi.fn(),
  updateQuantity: vi.fn(),
  updateDiscount: vi.fn(),
  removeItem: vi.fn(),
  onShow: vi.fn(),
  onSave: vi.fn(),
  onConfirm: vi.fn(),
  onPrint: vi.fn(),
  onClear: vi.fn(),
  isScreenLive: false
});

describe('CartPanel', () => {
  it('muestra productos, subtotal y total', () => {
    render(<CartPanel {...makeProps()} />);
    expect(screen.getByText('Martillo de prueba')).toBeInTheDocument();
    expect(screen.getAllByText(/20\.000/)).toHaveLength(2);
  });

  it('propaga cantidad, descuento y acciones del carrito', async () => {
    const user = userEvent.setup();
    const props = makeProps();
    render(<CartPanel {...props} />);

    await user.click(screen.getAllByRole('button').find((button) => button.querySelector('.lucide-plus')));
    expect(props.updateQuantity).toHaveBeenCalledWith(1, 3);

    const discountInput = screen.getAllByRole('spinbutton')[1];
    await user.clear(discountInput);
    await user.type(discountInput, '7');
    expect(props.updateDiscount).toHaveBeenLastCalledWith(1, '7');

    await user.click(screen.getByRole('button', { name: /vender/i }));
    expect(props.onConfirm).toHaveBeenCalledOnce();
  });

  it('permite seleccionar una sugerencia de cliente', async () => {
    const user = userEvent.setup();
    const props = {
      ...makeProps(),
      clientSuggestions: [{ id: 8, nombre: 'Ana Cliente', telefono: '999' }]
    };
    render(<CartPanel {...props} />);

    await user.type(screen.getByPlaceholderText(/buscar o crear cliente/i), 'An');
    await user.click(screen.getByRole('button', { name: /Ana Cliente/ }));
    expect(props.setCliente).toHaveBeenLastCalledWith({ nombre: 'Ana Cliente', telefono: '999' });
  });
});
