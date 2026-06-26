const {
  calculateCashRounding,
  calculatePaymentTotals
} = require('../../backend/src/utils/payment');

describe('redondeo legal para pagos en efectivo', () => {
  it.each([
    [1000, 0],
    [1001, -1],
    [1002, -2],
    [1003, -3],
    [1004, -4],
    [1005, -5],
    [1006, 4],
    [1007, 3],
    [1008, 2],
    [1009, 1]
  ])('calcula el ajuste para %i', (amount, expectedAdjustment) => {
    expect(calculateCashRounding(amount)).toBe(expectedAdjustment);
  });

  it('redondea 12.325 a 12.320 en efectivo', () => {
    expect(calculatePaymentTotals(12325, 'efectivo')).toEqual({
      unroundedTotal: 12325,
      roundingAdjustment: -5,
      finalTotal: 12320
    });
  });

  it.each(['transferencia', 'debito_credito'])('no redondea pagos por %s', (paymentMethod) => {
    expect(calculatePaymentTotals(12325, paymentMethod)).toEqual({
      unroundedTotal: 12325,
      roundingAdjustment: 0,
      finalTotal: 12325
    });
  });
});
