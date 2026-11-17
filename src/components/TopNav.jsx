import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutGrid, Layers, ClipboardList, Menu, X } from 'lucide-react';

export default function TopNav() {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const navItems = [
    { path: '/', label: 'Gallery', icon: LayoutGrid },
    { path: '/decks', label: 'Decks', icon: Layers },
    { path: '/review', label: 'Review', icon: ClipboardList },
  ];

  // Close the popup whenever the route changes.
  useEffect(() => { setOpen(false); }, [location.pathname]);

  return (
    <>
      {/* Mobile: single "Navigate" button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="md:hidden flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium min-h-[44px] w-full"
      >
        <Menu size={18} />
        <span>Navigate</span>
      </button>

      {/* Mobile: full-screen popup */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 bg-background flex flex-col">
          <div className="flex items-center justify-between px-4 h-14 border-b border-border shrink-0">
            <span className="text-sm font-semibold text-foreground">Navigate</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center w-10 h-10 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50"
              aria-label="Back"
            >
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-4 rounded-md text-base font-medium min-h-[56px] ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-foreground hover:bg-muted/50'
                  }`}
                >
                  <Icon size={20} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Desktop: inline nav (unchanged) */}
      <div className="hidden md:flex items-center gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-all text-sm font-medium ${
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <Icon size={16} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </>
  );
}