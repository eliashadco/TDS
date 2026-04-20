import * as React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, LineChart, Settings, PlusCircle, LogOut, Zap, Clock } from 'lucide-react';
import { auth } from '../../lib/firebase';
import { cn } from '../../lib/utils';

export function NavBar() {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: Zap, label: 'MarketWatch', path: '/marketwatch' },
    { icon: LineChart, label: 'Analytics', path: '/analytics' },
    { icon: PlusCircle, label: 'New Trade', path: '/trade/new' },
    { icon: Clock, label: 'Archive', path: '/trade/history' },
    { icon: Settings, label: 'Settings', path: '/settings' },
  ];

  return (
    <nav className="fixed left-0 top-0 bottom-0 w-64 bg-white border-r border-[var(--line)] flex flex-col">
      <div className="p-8 border-b border-[var(--line)]">
        <h1 className="font-serif italic text-2xl tracking-tight">Intelligent Investors</h1>
        <p className="text-[10px] font-mono uppercase opacity-50 mt-1 tracking-widest">Trading Decision System</p>
      </div>

      <div className="flex-1 py-8">
        {navItems.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={cn(
              'w-full flex items-center gap-4 px-8 py-4 text-sm font-mono uppercase tracking-widest transition-all group',
              location.pathname === item.path
                ? 'bg-[var(--ink)] text-[var(--bg)]'
                : 'hover:bg-gray-50 text-[var(--ink)]/70 hover:text-[var(--ink)]'
            )}
          >
            <item.icon size={18} className={cn('transition-transform group-hover:scale-110', location.pathname === item.path ? 'text-[var(--bg)]' : 'text-[var(--ink)]/40')} />
            {item.label}
          </button>
        ))}
      </div>

      <div className="p-8 border-t border-[var(--line)]">
        <button
          onClick={() => auth.signOut()}
          className="w-full flex items-center gap-4 text-sm font-mono uppercase tracking-widest text-red-600 hover:text-red-700 transition-colors"
        >
          <LogOut size={18} />
          Sign Out
        </button>
      </div>
    </nav>
  );
}
