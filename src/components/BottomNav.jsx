import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutGrid, Layers, PlusSquare, ClipboardList } from 'lucide-react';

export default function BottomNav() {
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Gallery', icon: LayoutGrid },
    { path: '/decks', label: 'Decks', icon: Layers },
    { path: '/creator', label: 'Create', icon: PlusSquare },
    { path: '/review', label: 'Review', icon: ClipboardList },
  ];

  return (
    <div className="flex items-center justify-center gap-8">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path;
        return (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <Icon size={18} />
            <span className="text-sm font-medium">{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}