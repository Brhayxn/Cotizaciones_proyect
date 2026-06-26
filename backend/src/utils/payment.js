const PAYMENT_METHODS = ['transferencia', 'debito_credito', 'efectivo'];

const isValidPaymentMethod = (value) => PAYMENT_METHODS.includes(value);

const calculateCashRounding = (amount) => {
  const total = Math.max(0, Math.round(Number(amount) || 0));
  const lastDigit = total % 10;

  if (lastDigit >= 1 && lastDigit <= 5) return -lastDigit;
  if (lastDigit >= 6) return 10 - lastDigit;
  return 0;
};

const calculatePaymentTotals = (amount, paymentMethod) => {
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

module.exports = {
  PAYMENT_METHODS,
  isValidPaymentMethod,
  calculateCashRounding,
  calculatePaymentTotals
};
