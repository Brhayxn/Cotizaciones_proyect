export const formatCurrency = (value = 0) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP'
  }).format(Number(value) || 0);
