export const calculateItemSubtotal = (item) => {
  // Acepta nombres de campo de carrito y de ventas guardadas para reutilizar el cálculo.
  const price = Number(item.precio ?? item.precio_unitario) || 0;
  const quantity = Number(item.cantidad) || 0;
  const discount = Number(item.descuento_aplicado) || 0;
  const numerator = price * quantity * (100 - discount);
  // Redondeo entero equivalente al backend para evitar diferencias de $1 en totales.
  return Math.floor((numerator + 50) / 100);
};

export const calculateQuoteTotal = (items) => (
  // El total siempre se deriva de los ítems actuales, no de un valor guardado en estado.
  items.reduce((total, item) => total + calculateItemSubtotal(item), 0)
);

export const PAYMENT_METHODS = [
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'debito_credito', label: 'Débito/crédito' },
  { value: 'efectivo', label: 'Efectivo' }
];

export const PAYMENT_METHOD_LABELS = Object.fromEntries(
  PAYMENT_METHODS.map((method) => [method.value, method.label])
);

export const calculateCashRounding = (amount) => {
  // En efectivo se ajusta al múltiplo de 10 más cercano según regla del negocio.
  const total = Math.max(0, Math.round(Number(amount) || 0));
  const lastDigit = total % 10;

  if (lastDigit >= 1 && lastDigit <= 5) return -lastDigit;
  if (lastDigit >= 6) return 10 - lastDigit;
  return 0;
};

export const calculatePaymentTotals = (amount, paymentMethod) => {
  // Solo efectivo modifica el total final; otros métodos conservan el total exacto.
  const unroundedTotal = Math.max(0, Math.round(Number(amount) || 0));
  const roundingAdjustment = paymentMethod === 'efectivo'
    ? calculateCashRounding(unroundedTotal)
    : 0;

  return {
    unroundedTotal,
    roundingAdjustment,
    finalTotal: unroundedTotal + roundingAdjustment
  };
};

export const clampQuantity = (quantity, stock) => (
  // Mantiene cantidades dentro de 1 y stock disponible mientras el usuario escribe.
  Math.min(Number(stock) || 1, Math.max(1, Number(quantity) || 1))
);

export const clampDiscount = (discount, maximum) => (
  // No permite superar el descuento máximo configurado por producto.
  Math.min(Number(maximum) || 0, Math.max(0, Number(discount) || 0))
);
