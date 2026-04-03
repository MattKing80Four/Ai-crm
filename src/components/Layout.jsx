import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Kanban,
  CheckSquare,
  Settings,
  Menu,
  X,
  Zap,
} from 'lucide-react';

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navigationItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/contacts', label: 'Contacts', icon: Users },
    { path: '/pipeline', label: 'Pipeline', icon: Kanban },
    { path: '/tasks', label: 'Tasks', icon: CheckSquare },
    { path: '/settings', label: 'Settings', icon: Settings },
  ];

  const navLinkClass = ({ isActive }) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium cursor-pointer ${
      isActive
        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25'
        : 'text-slate-600 hover:text-indigo-700 hover:bg-indigo-50'
    }`;

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="px-5 py-6">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 p-2 rounded-xl shadow-lg shadow-indigo-500/25">
            <Zap size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 leading-tight font-[family-name:var(--font-family-heading)]">Smart CRM</h1>
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">AI Image Services</p>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-4 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

      {/* Navigation */}
      <nav className="flex-1 p-3 mt-2 space-y-1">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={navLinkClass}
              onClick={() => setSidebarOpen(false)}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4">
        <div className="bg-gradient-to-br from-indigo-50 to-violet-50 rounded-xl p-3 border border-indigo-100/50">
          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Powered by</p>
          <p className="text-xs text-slate-600 mt-0.5 font-medium">Supabase + Claude AI</p>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-screen">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex fixed left-0 top-0 h-full w-[230px] glass-sidebar flex-col z-30">
        <SidebarContent />
      </div>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 glass-sidebar flex items-center px-4 z-40 border-b border-slate-200/60">
        <button
          onClick={() => setSidebarOpen(true)}
          className="text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer"
        >
          <Menu size={22} />
        </button>
        <div className="flex items-center gap-2 ml-3">
          <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 p-1.5 rounded-lg shadow-sm shadow-indigo-500/20">
            <Zap size={14} className="text-white" />
          </div>
          <span className="text-sm font-bold text-slate-900 font-[family-name:var(--font-family-heading)]">Smart CRM</span>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 glass-modal-backdrop" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-[270px] glass-sidebar flex flex-col shadow-2xl">
            <div className="absolute right-3 top-5">
              <button
                onClick={() => setSidebarOpen(false)}
                className="text-slate-400 hover:text-slate-700 transition-colors cursor-pointer p-1"
              >
                <X size={20} />
              </button>
            </div>
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 md:ml-[230px] flex flex-col h-screen">
        <main className="flex-1 overflow-y-auto pt-14 md:pt-0">
          <div className="p-4 md:p-6 lg:p-8 max-w-[1400px]">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
