import { Outlet, useLocation } from 'react-router-dom';
import BottomNav from './BottomNav.jsx';
import logoFerreteria from '../assets/logo-ferreteria-castillo.png';

const titles = {
  '/productos': 'Productos',
  '/clientes': 'Clientes',
  '/cotizar': 'Nueva cotización'
};

export default function Layout() {
  const location = useLocation();
  const title = titles[location.pathname] || 'Dashboard';

  return (
    <div className="min-h-screen overflow-hidden bg-[#090a0c] text-white">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(125,211,252,0.14),transparent_32%),radial-gradient(circle_at_80%_0%,rgba(226,232,240,0.08),transparent_30%),linear-gradient(145deg,#050506,#15171a_48%,#0b0d10)]" />
      <div className="fixed inset-0 opacity-[0.18] noise-layer" />
      <main className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 pb-28 pt-5 sm:px-6 lg:px-8">
        <header className="mb-5 flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 shadow-soft sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-36 shrink-0 items-center justify-center rounded-[1.3rem] border border-white/10 bg-black/25 p-2 shadow-insetSoft">
              <img className="max-h-full max-w-full object-contain" src={logoFerreteria} alt="Ferretería Castillo SPA" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.32em] text-sky-200/80">Ferretería Castillo SPA</p>
              <h1 className="mt-2 font-display text-3xl font-semibold tracking-normal sm:text-4xl">{title}</h1>
            </div>
          </div>
          <div className="rounded-full border border-white/10 bg-black/30 px-4 py-2 text-sm text-zinc-300 shadow-insetSoft">
            Pantalla: <span className="text-white">pantalla-1</span>
          </div>
        </header>
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
