// Recorridos de aceptación en escritorio y móvil.
const { test, expect } = require('@playwright/test');

test.describe.configure({ mode: 'serial' });

test('navega y realiza CRUD de cliente y producto', async ({ page }, testInfo) => {
  const suffix = testInfo.project.name.startsWith('mobile') ? 'Móvil' : 'PC';
  const clientName = `Cliente E2E ${suffix}`;
  const productName = `Producto E2E ${suffix}`;

  await page.goto('/clientes');
  await page.getByRole('button', { name: /cliente/i }).click();
  await page.locator('.client-form').getByLabel('Nombre').fill(clientName);
  await page.locator('.client-form').getByLabel(/Tel/).fill('911111111');
  await page.locator('.client-form').getByRole('button', { name: '' }).first().click();
  await expect(page.getByText(clientName)).toBeVisible();

  const clientCard = page.locator('.client-card').filter({ hasText: clientName });
  await clientCard.getByRole('button', { name: /editar/i }).click();
  await page.locator('.client-form').getByLabel('Nombre').fill(`${clientName} Editado`);
  await page.locator('.client-form').getByRole('button', { name: '' }).first().click();
  await expect(page.getByText(`${clientName} Editado`)).toBeVisible();
  await page.locator('.client-card').filter({ hasText: `${clientName} Editado` }).getByRole('button', { name: /eliminar/i }).click();
  await expect(page.getByText(`${clientName} Editado`)).toHaveCount(0);

  await page.locator('a[href="/productos"]').click();
  await page.getByRole('button', { name: 'Producto', exact: true }).click();
  const productForm = page.locator('.product-form');
  await productForm.getByLabel('Nombre').fill(productName);
  await productForm.getByLabel('Precio').fill('2990');
  await productForm.getByLabel('Stock').fill('4');
  await productForm.getByRole('button', { name: /guardar/i }).click();
  await expect(page.getByText(productName)).toBeVisible();

  const productCard = page.locator('.products-grid .glass-card').filter({ hasText: productName });
  await productCard.getByTitle('Editar producto').click();
  await productForm.getByLabel('Precio').fill('3490');
  await productForm.getByRole('button', { name: /guardar/i }).click();
  await expect(productCard.getByText(/3\.490/)).toBeVisible();
  await productCard.getByTitle('Cambiar estado').click();
});

test('cotiza, imprime, confirma, refleja dashboard y anula restaurando stock', async ({ page }) => {
  await page.goto('/venta');
  const productCard = page.locator('.glass-card').filter({ hasText: 'Martillo de prueba' });
  await productCard.getByRole('button', { name: /agregar/i }).click();
  await page.getByPlaceholder(/buscar o crear cliente/i).fill('Cliente Venta E2E');

  const discount = page.locator('.cart-item input[type="number"]').nth(1);
  await discount.fill('10');
  await expect(page.locator('.cart-total')).toContainText('9.000');

  await page.getByRole('button', { name: 'PDF' }).click();
  await expect.poll(() => page.evaluate(() => Boolean(localStorage.getItem('printableQuote')))).toBe(true);

  await page.getByRole('button', { name: /transferencia/i }).click();
  await page.getByRole('button', { name: /vender/i }).click();
  await expect(page.getByText(/Venta confirmada y stock descontado/i)).toBeVisible();

  await page.locator('a[href="/productos"]').click();
  await expect(page.locator('.products-grid .glass-card').filter({ hasText: 'Martillo de prueba' })).toContainText('Stock 4');

  await page.locator('a[href="/dashboard"]').click();
  await expect(page.getByText('Ventas realizadas').locator('..')).toContainText('1');

  await page.locator('a[href="/venta"]').click();
  await page.getByRole('button', { name: 'Ventas' }).click();
  await expect(page.getByRole('heading', { name: 'Ventas recientes' })).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('article').filter({ hasText: 'Cliente Venta E2E' }).getByRole('button', { name: /anular/i }).click();
  await expect(page.getByText('Venta anulada correctamente')).toBeVisible();

  await page.getByTitle('Cerrar').click();
  await page.locator('a[href="/productos"]').click();
  await expect(page.locator('.products-grid .glass-card').filter({ hasText: 'Martillo de prueba' })).toContainText('Stock 5');
});

test('sincroniza y limpia la pantalla cliente mediante Socket.io', async ({ page, browser }) => {
  const customerContext = await browser.newContext();
  const customerPage = await customerContext.newPage();
  await customerPage.goto('/pantalla/pantalla-1');
  await expect(customerPage.getByText('Conectado')).toBeVisible();

  await page.goto('/venta');
  await page.locator('.glass-card').filter({ hasText: 'Martillo de prueba' }).getByRole('button', { name: /agregar/i }).click();
  await page.getByPlaceholder(/buscar o crear cliente/i).fill('Cliente Pantalla E2E');
  await page.getByRole('button', { name: /mostrar/i }).click();

  await expect(customerPage.getByText('Cliente Pantalla E2E')).toBeVisible();
  await expect(customerPage.getByText('Martillo de prueba')).toBeVisible();
  await page.getByTitle('Limpiar carrito').click();
  await expect(customerPage.getByText(/Esperando cotizaci/)).toBeVisible();
  await customerContext.close();
});
