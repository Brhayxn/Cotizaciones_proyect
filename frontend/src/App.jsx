import React from "react"
import { Toaster } from 'react-hot-toast';
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import ProductsPage from './pages/ProductsPage.jsx';
import ClientsPage from './pages/ClientsPage.jsx';
import QuotePage from './pages/QuotePage.jsx';
import InventoryPage from './pages/InventoryPage.jsx';
import CustomerScreenPage from './pages/CustomerScreenPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import PrintableQuote from './components/PrintableQuote.jsx';

export default function App() {
  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 2600,
          style: {
            background: 'rgba(17, 19, 24, 0.96)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '18px',
            boxShadow: '18px 18px 42px rgba(0,0,0,0.42)',
            color: '#f8fafc',
            fontWeight: 700
          },
          success: {
            iconTheme: {
              primary: '#bae6fd',
              secondary: '#050608'
            }
          },
          error: {
            iconTheme: {
              primary: '#fca5a5',
              secondary: '#050608'
            }
          }
        }}
      />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="productos" element={<ProductsPage />} />
          <Route path="clientes" element={<ClientsPage />} />
          <Route path="inventario" element={<InventoryPage />} />
          <Route path="venta" element={<QuotePage />} />
        </Route>
        <Route path="/pantalla-cliente" element={<CustomerScreenPage />} />
        <Route path="/pantalla/:screenId" element={<CustomerScreenPage />} />
        <Route path="/cotizacion/imprimir" element={<PrintableQuote />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </>
  );
}
