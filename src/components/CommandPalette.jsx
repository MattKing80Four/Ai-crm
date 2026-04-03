import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  getColorFromHash, getInitials, getContactFullName, formatCurrency,
  getTaskTypeInfo,
} from '../lib/utils';
import {
  Search, Users, TrendingUp, CheckSquare, UserPlus, DollarSign, ListPlus,
  LayoutDashboard, Kanban, FolderKanban, Settings, X, ArrowRight, Command,
} from 'lucide-react';

const PAGES = [
  { type: 'page', label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { type: 'page', label: 'Contacts', path: '/contacts', icon: Users },
  { type: 'page', label: 'Pipeline', path: '/pipeline', icon: Kanban },
  { type: 'page', label: 'Tasks', path: '/tasks', icon: CheckSquare },
  { type: 'page', label: 'Projects', path: '/projects', icon: FolderKanban },
  { type: 'page', label: 'Settings', path: '/settings', icon: Settings },
];

const ACTIONS = [
  { type: 'action', label: 'New Contact', path: '/contacts?action=new', icon: UserPlus },
  { type: 'action', label: 'New Deal', path: '/pipeline?action=new', icon: DollarSign },
  { type: 'action', label: 'New Task', path: '/tasks?action=new', icon: ListPlus },
];

export default function CommandPalette() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [contacts, setContacts] = useState([]);
  const [deals, setDeals] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Open/close with Cmd+K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Load data when opened
  useEffect(() => {
    if (open && !loaded) {
      Promise.all([
        supabase.from('contacts').select('id, first_name, last_name, email, company').order('first_name'),
        supabase.from('deals').select('id, title, value, status').order('created_at', { ascending: false }),
        supabase.from('tasks').select('id, title, status, type, priority').order('created_at', { ascending: false }).limit(50),
      ]).then(([c, d, t]) => {
        setContacts(c.data || []);
        setDeals(d.data || []);
        setTasks(t.data || []);
        setLoaded(true);
      });
    }
  }, [open, loaded]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [open]);

  // Filter results
  const results = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) {
      return [
        { group: 'Quick Actions', items: ACTIONS },
        { group: 'Navigate', items: PAGES },
      ];
    }

    const matchedActions = ACTIONS.filter(a => a.label.toLowerCase().includes(q));
    const matchedPages = PAGES.filter(p => p.label.toLowerCase().includes(q));
    const matchedContacts = contacts
      .filter(c => {
        const name = `${c.first_name} ${c.last_name}`.toLowerCase();
        return name.includes(q) || (c.email || '').toLowerCase().includes(q) || (c.company || '').toLowerCase().includes(q);
      })
      .slice(0, 5)
      .map(c => ({
        type: 'contact',
        label: getContactFullName(c),
        sublabel: c.company || c.email,
        path: `/contacts/${c.id}`,
        icon: Users,
        avatar: c,
      }));

    const matchedDeals = deals
      .filter(d => d.title.toLowerCase().includes(q))
      .slice(0, 5)
      .map(d => ({
        type: 'deal',
        label: d.title,
        sublabel: d.value ? formatCurrency(d.value) : d.status,
        path: '/pipeline',
        icon: TrendingUp,
      }));

    const matchedTasks = tasks
      .filter(t => t.title.toLowerCase().includes(q))
      .slice(0, 5)
      .map(t => ({
        type: 'task',
        label: t.title,
        sublabel: `${getTaskTypeInfo(t.type).label} · ${t.status}`,
        path: '/tasks',
        icon: CheckSquare,
      }));

    const groups = [];
    if (matchedActions.length) groups.push({ group: 'Actions', items: matchedActions });
    if (matchedContacts.length) groups.push({ group: 'Contacts', items: matchedContacts });
    if (matchedDeals.length) groups.push({ group: 'Deals', items: matchedDeals });
    if (matchedTasks.length) groups.push({ group: 'Tasks', items: matchedTasks });
    if (matchedPages.length) groups.push({ group: 'Pages', items: matchedPages });
    return groups;
  }, [query, contacts, deals, tasks]);

  const flatItems = useMemo(() => results.flatMap(g => g.items), [results]);

  // Keyboard navigation
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, flatItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && flatItems[selectedIndex]) {
      e.preventDefault();
      selectItem(flatItems[selectedIndex]);
    }
  }, [flatItems, selectedIndex]);

  const selectItem = (item) => {
    navigate(item.path);
    setOpen(false);
  };

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const el = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!open) return null;

  let itemIndex = -1;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={() => setOpen(false)}>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg mx-4 bg-white rounded-xl shadow-2xl border border-border overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: 'scaleIn 150ms ease' }}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search size={18} className="text-text-subtle flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search contacts, deals, tasks..."
            className="flex-1 bg-transparent text-text text-sm outline-none placeholder:text-text-subtle"
          />
          <kbd className="hidden sm:flex items-center gap-0.5 text-[10px] text-text-subtle bg-surface px-1.5 py-0.5 rounded border border-border-subtle font-mono">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto py-2">
          {results.length === 0 && (
            <div className="text-center py-8">
              <p className="text-text-subtle text-sm">No results for "{query}"</p>
            </div>
          )}
          {results.map((group) => (
            <div key={group.group}>
              <p className="text-[10px] font-semibold text-text-subtle uppercase tracking-wider px-4 py-1.5">
                {group.group}
              </p>
              {group.items.map((item) => {
                itemIndex++;
                const idx = itemIndex;
                const Icon = item.icon;
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={`${item.type}-${item.label}-${idx}`}
                    data-index={idx}
                    onClick={() => selectItem(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors cursor-pointer ${
                      isSelected ? 'bg-primary-50' : 'hover:bg-surface'
                    }`}
                  >
                    {item.avatar ? (
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white font-semibold text-[10px] flex-shrink-0"
                        style={{ backgroundColor: getColorFromHash(`${item.avatar.first_name}${item.avatar.last_name}`) }}
                      >
                        {getInitials(item.avatar.first_name, item.avatar.last_name)}
                      </div>
                    ) : (
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        item.type === 'action' ? 'bg-primary-50' : 'bg-surface'
                      }`}>
                        <Icon size={14} className={item.type === 'action' ? 'text-primary-600' : 'text-text-muted'} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm truncate ${isSelected ? 'text-primary-700 font-medium' : 'text-text'}`}>
                        {item.label}
                      </p>
                      {item.sublabel && (
                        <p className="text-xs text-text-subtle truncate">{item.sublabel}</p>
                      )}
                    </div>
                    {isSelected && (
                      <ArrowRight size={14} className="text-primary-400 flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-border-subtle px-4 py-2 flex items-center gap-4 text-[10px] text-text-subtle">
          <span className="flex items-center gap-1"><kbd className="bg-surface px-1 py-0.5 rounded border border-border-subtle font-mono">↑↓</kbd> navigate</span>
          <span className="flex items-center gap-1"><kbd className="bg-surface px-1 py-0.5 rounded border border-border-subtle font-mono">↵</kbd> select</span>
          <span className="flex items-center gap-1"><kbd className="bg-surface px-1 py-0.5 rounded border border-border-subtle font-mono">esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
