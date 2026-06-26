import '../setup/frontend.mjs';
import { describe, expect, it } from 'vitest';
import {
  calculateItemSubtotal,
  calculateCashRounding,
  calculatePaymentTotals,
  calculateQuoteTotal,
  clampDiscount,
  clampQuantity
} from '../../frontend/src/utils/quoteCalculations.js';

describe('cálculos de cotización', () => {
  it('calcula subtotales con descuento y redondeo CLP', () => {
    expect(calculateItemSubtotal({ precio: 1999, cantidad: 3, descuento_aplicado: 10 })).toBe(5397);
    expect(calculateItemSubtotal({ precio: 1615, cantidad: 5, descuento_aplicado: 10 })).toBe(7268);
  });

  it('suma el total de todos los productos', () => {
    expect(calculateQuoteTotal([
      { precio: 1000, cantidad: 2, descuento_aplicado: 0 },
      { precio: 5000, cantidad: 1, descuento_aplicado: 20 }
    ])).toBe(6000);
  });

  it('limita cantidad por stock y descuento por máximo', () => {
    expect(clampQuantity(0, 5)).toBe(1);
    expect(clampQuantity(99, 5)).toBe(5);
    expect(clampDiscount(-2, 10)).toBe(0);
    expect(clampDiscount(50, 10)).toBe(10);
  });

  it.each([
    [0, 0],
    [1, -1],
    [2, -2],
    [3, -3],
    [4, -4],
    [5, -5],
    [6, 4],
    [7, 3],
    [8, 2],
    [9, 1]
  ])('redondea el terminal %i en efectivo', (lastDigit, adjustment) => {
    expect(calculateCashRounding(12320 + lastDigit)).toBe(adjustment);
  });

  it('mantiene el total exacto para transferencia y débito/crédito', () => {
    expect(calculatePaymentTotals(12325, 'transferencia').finalTotal).toBe(12325);
    expect(calculatePaymentTotals(12325, 'debito_credito').finalTotal).toBe(12325);
    expect(calculatePaymentTotals(12325, 'efectivo').finalTotal).toBe(12320);
  });
});
