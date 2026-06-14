import { useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Boxes, Package, ReceiptText, UsersRound } from 'lucide-react';

const items = [
  { to: '/productos', label: 'Productos', icon: Package },
  { to: '/clientes', label: 'Clientes', icon: UsersRound },
  { to: '/inventario', label: 'Inventario', icon: Boxes },
  { to: '/venta', label: 'Venta', icon: ReceiptText },
];

export default function BottomNav() {
  const [isCollapsing, setIsCollapsing] = useState(false);
  const collapseTimer = useRef(null);

  const collapseAfterSelect = (event) => {
    event.currentTarget.blur();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    window.clearTimeout(collapseTimer.current);
    setIsCollapsing(true);
    collapseTimer.current = window.setTimeout(() => setIsCollapsing(false), 420);
  };

  return (
    <nav className={`side-nav no-print fixed left-3 top-1/2 z-50 -translate-y-1/2 rounded-[1.4rem] border border-white/10 bg-black/80 p-2 shadow-soft ${isCollapsing ? 'is-collapsing' : ''}`}>
      <div className="grid gap-1">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={collapseAfterSelect}
            className={({ isActive }) =>
              `side-nav-link relative flex h-12 items-center justify-center gap-2 rounded-full px-3 text-sm transition-all duration-300 ${
                isActive
                  ? 'bg-white text-black shadow-glow'
                  : 'text-zinc-400 hover:text-white'
              }`
            }
          >
            <Icon size={19} strokeWidth={2.4} />
            <span className="side-nav-label">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
