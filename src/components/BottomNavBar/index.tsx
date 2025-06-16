import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Activity, Settings } from 'lucide-react';

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navigationItems: NavItem[] = [
  {
    path: '/',
    label: 'Início',
    icon: Home
  },
  {
    path: '/atividades',
    label: 'Atividades',
    icon: Activity
  },
  {
    path: '/configuracoes',
    label: 'Configurações',
    icon: Settings
  }
];

export function BottomNavBar() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 h-16 shadow-lg z-40">
      <div className="h-full max-w-screen-xl mx-auto px-4">
        <div className="flex justify-around h-full items-center">
          {navigationItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => {
                const baseClasses = 'flex flex-col items-center justify-center px-4 py-2 rounded-md transition-all duration-200';
                const activeClasses = 'bg-blue-50 shadow';
                const inactiveClasses = 'text-gray-600 hover:text-blue-600 hover:bg-gray-100';

                let colorClass = isActive ? 'text-blue-600' : 'text-gray-600';

                // Forçar a cor azul para o item de Atividades
                if (item.path === '/atividades') {
                  colorClass = 'text-blue-600';
                }

                return `${baseClasses} ${colorClass} ${isActive ? activeClasses : inactiveClasses}`;
              }}
            >
              {React.createElement(item.icon, { className: 'w-6 h-6 mb-1' })}
              <span className="text-xs font-medium">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}
