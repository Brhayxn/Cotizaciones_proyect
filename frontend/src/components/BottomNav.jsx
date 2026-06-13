import { NavLink } from 'react-router-dom';
import { MonitorUp, Package, ReceiptText, UsersRound } from 'lucide-react';

const items = [
  { to: '/productos', label: 'Productos', icon: Package },
  { to: '/clientes', label: 'Clientes', icon: UsersRound },
  { to: '/cotizar', label: 'Cotizar', icon: ReceiptText },
  { to: '/pantalla-cliente', label: 'Pantalla', icon: MonitorUp }
];

export default function BottomNav() {
  return (
    <nav className="no-print fixed bottom-5 left-1/2 z-50 w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 rounded-full border border-white/10 bg-black/80 px-2 py-2 shadow-soft">
      <div className="grid grid-cols-4 gap-1">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `relative flex h-14 items-center justify-center gap-2 rounded-full px-3 text-sm transition-all duration-300 ${
                isActive
                  ? 'bg-white text-black shadow-glow'
                  : 'text-zinc-400 hover:text-white'
              }`
            }
          >
            <Icon size={19} strokeWidth={2.4} />
            <span className="hidden sm:inline">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
