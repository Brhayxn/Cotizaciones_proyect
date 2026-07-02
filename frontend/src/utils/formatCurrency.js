export const formatCurrency = (value = 0) =>
  // Formato único para pesos chilenos en toda la interfaz.
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP'
  }).format(Number(value) || 0);
