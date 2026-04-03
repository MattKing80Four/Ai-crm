import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Kanban,
  CheckSquare,
  Settings,
  FolderKanban,
  Menu,
  X,
  Zap,
  Plus,
  UserPlus,
  ListPlus,
  DollarSign,
} from 'lucide-react';

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const quickAddRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (quickAddRef.current && !quickAddRef.current.contains(e.target)) {
        setQuickAddOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const mainNav = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/contacts', label: 'Contacts', icon: Users },
    { path: '/pipeline', label: 'Pipeline', icon: Kanban },
  ];

  const workNav = [
    { path: '/tasks', label: 'Tasks', icon: CheckSquare },
    { path: '/projects', label: 'Projects', icon: FolderKanban },
  ];

  const quickActions = [
    { label: 'New Contact', icon: UserPlus, action: () => { navigate('/contacts?action=new'); setQuickAddOpen(false); setSidebarOpen(false); } },
    { label: 'New Deal', icon: DollarSign, action: () => { navigate('/pipeline?action=new'); setQuickAddOpen(false); setSidebarOpen(false); } },
    { label: 'New Task', icon: ListPlus, action: () => { navigate('/tasks?action=new'); setQuickAddOpen(false); setSidebarOpen(false); } },
  ];

  const navLinkClass = ({ isActive }) =>
    `nav-item ${isActive ? 'nav-item-active' : ''}`;

  const SidebarContent = () => (
    <>
      {/* Logo + Quick Add */}
      <div className="px-4 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-primary-600 p-1.5 rounded-lg">
              <Zap size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-text leading-tight">Smart CRM</h1>
              <p className="text-[10px] text-text-subtle font-medium uppercase tracking-wider">AI Image Services</p>
            </div>
          </div>
          <div className="relative" ref={quickAddRef}>
            <button
              onClick={() => setQuickAddOpen(!quickAddOpen)}
              className="w-7 h-7 flex items-center justify-center rounded-md bg-primary-50 text-primary-600 hover:bg-primary-100 transition-colors cursor-pointer"
            >
              <Plus size={16} />
            </button>
            {quickAddOpen && (
              <div className="absolute right-0 top-9 w-44 card shadow-lg z-50 py-1">
                {quickActions.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.label}
                      onClick={item.action}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-text-secondary hover:bg-surface transition-colors cursor-pointer text-left"
                    >
                      <Icon size={15} className="text-text-subtle" />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-3 space-y-5 mt-1">
        <div>
          <p className="section-title">Main</p>
          <div className="space-y-0.5">
            {mainNav.map((item) => {
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
          </div>
        </div>

        <div>
          <p className="section-title">Work</p>
          <div className="space-y-0.5">
            {workNav.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={navLinkClass}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Settings at bottom */}
      <div className="px-3 pb-4 border-t border-border pt-3">
        <NavLink
          to="/settings"
          className={navLinkClass}
          onClick={() => setSidebarOpen(false)}
        >
          <Settings size={18} />
          <span>Settings</span>
        </NavLink>
      </div>
    </>
  );

  return (
    <div className="flex h-screen">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex fixed left-0 top-0 h-full w-[220px] glass-sidebar flex-col z-30">
        <SidebarContent />
      </div>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-surface-card border-b border-border flex items-center justify-between px-4 z-40">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-text-muted hover:text-text transition-colors cursor-pointer"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="bg-primary-600 p-1 rounded-md">
              <Zap size={14} className="text-white" />
            </div>
            <span className="text-sm font-bold text-text">Smart CRM</span>
          </div>
        </div>
        <button
          onClick={() => setQuickAddOpen(!quickAddOpen)}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-primary-600 text-white cursor-pointer"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-[260px] bg-surface-card flex flex-col shadow-xl border-r border-border">
            <div className="absolute right-3 top-4">
              <button
                onClick={() => setSidebarOpen(false)}
                className="text-text-subtle hover:text-text transition-colors cursor-pointer p-1"
              >
                <X size={18} />
              </button>
            </div>
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 md:ml-[220px] flex flex-col h-screen">
        <main className="flex-1 overflow-y-auto pt-14 md:pt-0">
          <div className="p-4 md:p-6 lg:p-8 max-w-[1400px]">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
