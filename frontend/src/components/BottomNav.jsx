import { useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Boxes, LayoutDashboard, Package, ReceiptText, Store, UsersRound } from 'lucide-react';
import logoFerreteria from '../assets/logo-ferreteria-castillo.png';

const sections = [
  {
    title: 'Menu principal',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/venta', label: 'Ventas', icon: ReceiptText }
    ]
  },
  {
    title: 'Gestion',
    items: [
      { to: '/productos', label: 'Productos', icon: Package },
      { to: '/clientes', label: 'Clientes', icon: UsersRound },
      { to: '/inventario', label: 'Inventario', icon: Boxes }
    ]
  }
];

export default function BottomNav() {
  // Pequeña animación para compactar la navegación después de seleccionar una ruta.
  const [isCollapsing, setIsCollapsing] = useState(false);
  const collapseTimer = useRef(null);

  const collapseAfterSelect = (event) => {
    // Quita foco visual en botones después de navegar.
    event.currentTarget.blur();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    window.clearTimeout(collapseTimer.current);
    setIsCollapsing(true);
    collapseTimer.current = window.setTimeout(() => setIsCollapsing(false), 420);
  };

  return (
    <nav className={`side-nav no-print fixed left-0 top-0 z-50 flex h-screen flex-col rounded-none border-r border-white/10 p-2 shadow-soft ${isCollapsing ? 'is-collapsing' : ''}`} aria-label="Navegación principal">
      <div className="side-nav-brand flex items-center gap-3 overflow-hidden rounded-2xl">
        <span className="side-nav-logo grid h-12 w-12 shrink-0 place-items-center rounded-2xl">
          <img className="h-8 w-8 object-contain" src={logoFerreteria} alt="" />
        </span>
        <span className="side-nav-brand-text min-w-0">
          <span className="block truncate text-sm font-extrabold text-slate-50">Ferreteria Castillo</span>
        </span>
      </div>

      <div className="side-nav-sections grid gap-3">
        {sections.map((section) => (
          <section className="side-nav-section" key={section.title}>
            <p className="side-nav-section-title">{section.title}</p>
            <div className="grid gap-1.5">
              {section.items.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={collapseAfterSelect}
                  className={({ isActive }) =>
                    `side-nav-link relative flex h-12 items-center justify-center gap-3 rounded-xl px-3 text-sm font-bold transition-all duration-300 ${
                      isActive
                        ? 'is-active text-slate-950'
                        : 'text-slate-400 hover:text-slate-50'
                    }`
                  }
                >
                  <Icon className="side-nav-icon shrink-0" size={19} strokeWidth={2.35} />
                  <span className="side-nav-label">{label}</span>
                </NavLink>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="side-nav-profile mt-auto flex items-center gap-3 overflow-hidden rounded-xl bg-white px-2 py-2 text-slate-950">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-sky-400 to-indigo-600 text-white">
          <Store size={18} strokeWidth={2.4} />
        </span>
        <span className="side-nav-profile-text min-w-0">
          <span className="block truncate text-xs font-extrabold">Ferreteria Castillo</span>
          <span className="block truncate text-[0.66rem] font-bold text-slate-500">Administrador</span>
        </span>
      </div>
    </nav>
  );
}
