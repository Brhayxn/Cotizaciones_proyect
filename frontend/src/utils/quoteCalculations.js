export const calculateItemSubtotal = (item) => {
  const price = Number(item.precio ?? item.precio_unitario) || 0;
  const quantity = Number(item.cantidad) || 0;
  const discount = Number(item.descuento_aplicado) || 0;
  const numerator = price * quantity * (100 - discount);
  return Math.floor((numerator + 50) / 100);
};

export const calculateQuoteTotal = (items) => (
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
  const total = Math.max(0, Math.round(Number(amount) || 0));
  const lastDigit = total % 10;

  if (lastDigit >= 1 && lastDigit <= 5) return -lastDigit;
  if (lastDigit >= 6) return 10 - lastDigit;
  return 0;
};

export const calculatePaymentTotals = (amount, paymentMethod) => {
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
  Math.min(Number(stock) || 1, Math.max(1, Number(quantity) || 1))
);

export const clampDiscount = (discount, maximum) => (
  Math.min(Number(maximum) || 0, Math.max(0, Number(discount) || 0))
);
