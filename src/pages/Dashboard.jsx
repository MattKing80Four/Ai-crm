import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  Users,
  TrendingUp,
  CheckSquare,
  PoundSterling,
  Clock,
  Plus,
} from 'lucide-react';
import { formatDistanceToNow, format, isToday, isPast, parseISO } from 'date-fns';

const AVATAR_COLORS = ['#8b5cf6', '#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

function getColorFromHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(firstName, lastName) {
  return `${(firstName || '').charAt(0)}${(lastName || '').charAt(0)}`.toUpperCase();
}

function SkeletonLoader() {
  return (
    <div className="space-y-6">
      {/* Stats skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="glass-card p-5">
            <div className="skeleton h-10 w-10 rounded-xl mb-3" />
            <div className="skeleton h-4 w-24 mb-2" />
            <div className="skeleton h-8 w-16" />
          </div>
        ))}
      </div>
      {/* Content skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="glass-card p-5">
            <div className="skeleton h-5 w-32 mb-4" />
            {[...Array(3)].map((_, j) => (
              <div key={j} className="skeleton h-14 w-full mb-3 rounded-xl" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ contacts: 0, activeDeals: 0, pendingTasks: 0, pipelineValue: 0 });
  const [recentContacts, setRecentContacts] = useState([]);
  const [upcomingTasks, setUpcomingTasks] = useState([]);
  const [recentDeals, setRecentDeals] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      const [contactsRes, dealsRes, tasksRes, notesRes, interactionsRes, stagesRes] = await Promise.all([
        supabase.from('contacts').select('*').order('created_at', { ascending: false }),
        supabase.from('deals').select('*').order('created_at', { ascending: false }),
        supabase.from('tasks').select('*').order('due_date', { ascending: true }),
        supabase.from('notes').select('*').order('created_at', { ascending: false }).limit(5),
        supabase.from('interactions').select('*').order('created_at', { ascending: false }).limit(5),
        supabase.from('pipeline_stages').select('*').order('position', { ascending: true }),
      ]);

      const contacts = contactsRes.data || [];
      const deals = dealsRes.data || [];
      const tasks = tasksRes.data || [];

      const activeDeals = deals.filter(d => d.status === 'active' || !d.status);
      const pipelineValue = activeDeals.reduce((sum, d) => sum + (d.value || 0), 0);
      const pendingTasks = tasks.filter(t => t.status !== 'Completed' && t.status !== 'completed' && t.status !== 'Cancelled');

      setStats({
        contacts: contacts.length,
        activeDeals: activeDeals.length,
        pendingTasks: pendingTasks.length,
        pipelineValue,
      });

      setRecentContacts(contacts.slice(0, 5));
      setUpcomingTasks(pendingTasks.slice(0, 5));
      setRecentDeals(deals.slice(0, 5));

      const allActivities = [
        ...(notesRes.data || []).map(n => ({
          id: `note-${n.id}`,
          type: 'note',
          description: n.content?.substring(0, 80) + (n.content?.length > 80 ? '...' : ''),
          created_at: n.created_at,
          source: n.source,
        })),
        ...(interactionsRes.data || []).map(i => ({
          id: `interaction-${i.id}`,
          type: 'interaction',
          description: i.subject || i.content?.substring(0, 80) || 'Interaction logged',
          created_at: i.created_at,
          channel: i.channel,
        })),
      ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 8);

      setActivities(allActivities);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority) => {
    const p = (priority || '').toLowerCase();
    if (p === 'urgent') return 'bg-red-100 text-red-700';
    if (p === 'high') return 'bg-orange-100 text-orange-700';
    if (p === 'medium') return 'bg-blue-100 text-blue-700';
    return 'bg-slate-100 text-slate-600';
  };

  const getDueDateLabel = (dueDate) => {
    if (!dueDate) return null;
    const date = parseISO(dueDate);
    if (isToday(date)) return { text: 'Today', color: 'text-amber-600' };
    if (isPast(date)) return { text: 'Overdue', color: 'text-red-600' };
    return { text: format(date, 'MMM d'), color: 'text-slate-500' };
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="skeleton h-9 w-48 mb-2" />
          <div className="skeleton h-5 w-64" />
        </div>
        <SkeletonLoader />
      </div>
    );
  }

  const statCards = [
    { label: 'Total Contacts', value: stats.contacts, icon: Users, iconBg: 'bg-indigo-100', iconColor: 'text-indigo-600', nav: '/contacts' },
    { label: 'Active Deals', value: stats.activeDeals, icon: TrendingUp, iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', nav: '/pipeline' },
    { label: 'Pending Tasks', value: stats.pendingTasks, icon: CheckSquare, iconBg: 'bg-amber-100', iconColor: 'text-amber-600', nav: '/tasks' },
    { label: 'Pipeline Value', value: stats.pipelineValue > 0 ? `£${stats.pipelineValue.toLocaleString()}` : '£0', icon: PoundSterling, iconBg: 'bg-violet-100', iconColor: 'text-violet-600', nav: '/pipeline' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 mt-1">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>
        <button
          onClick={() => navigate('/contacts')}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl transition-all duration-200 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 cursor-pointer"
        >
          <Plus size={18} />
          Add Contact
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="glass-card glass-card-hover p-5 cursor-pointer"
              onClick={() => navigate(card.nav)}
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`${card.iconBg} p-2.5 rounded-xl`}>
                  <Icon size={20} className={card.iconColor} />
                </div>
              </div>
              <h3 className="text-slate-500 text-sm font-medium">{card.label}</h3>
              <p className="text-3xl font-bold text-slate-900 mt-1">{card.value}</p>
            </div>
          );
        })}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming Tasks */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Upcoming Tasks</h2>
            <button
              onClick={() => navigate('/tasks')}
              className="text-indigo-600 hover:text-indigo-700 text-sm font-medium transition-colors cursor-pointer"
            >
              View All
            </button>
          </div>
          {upcomingTasks.length === 0 ? (
            <div className="text-center py-6">
              <CheckSquare size={28} className="mx-auto text-slate-300 mb-2" />
              <p className="text-slate-400 text-sm">No pending tasks</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {upcomingTasks.map((task) => {
                const due = getDueDateLabel(task.due_date);
                return (
                  <div
                    key={task.id}
                    className="flex items-start gap-3 p-3 rounded-xl bg-white/50 border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all duration-200 cursor-pointer"
                    onClick={() => navigate('/tasks')}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-800 text-sm font-medium truncate">{task.title}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(task.priority)}`}>
                          {task.priority || 'Medium'}
                        </span>
                        {due && (
                          <span className={`text-xs ${due.color} flex items-center gap-1`}>
                            <Clock size={12} />
                            {due.text}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Contacts */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Recent Contacts</h2>
            <button
              onClick={() => navigate('/contacts')}
              className="text-indigo-600 hover:text-indigo-700 text-sm font-medium transition-colors cursor-pointer"
            >
              View All
            </button>
          </div>
          {recentContacts.length === 0 ? (
            <div className="text-center py-6">
              <Users size={28} className="mx-auto text-slate-300 mb-2" />
              <p className="text-slate-400 text-sm">No contacts yet</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {recentContacts.map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/50 border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all duration-200 cursor-pointer"
                  onClick={() => navigate(`/contacts/${contact.id}`)}
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold text-xs flex-shrink-0 shadow-sm"
                    style={{ backgroundColor: getColorFromHash(`${contact.first_name}${contact.last_name}`) }}
                  >
                    {getInitials(contact.first_name, contact.last_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-800 text-sm font-medium truncate">
                      {contact.first_name} {contact.last_name}
                    </p>
                    <p className="text-slate-400 text-xs truncate">
                      {contact.company || contact.email || 'No details'}
                    </p>
                  </div>
                  <span className="text-slate-400 text-xs flex-shrink-0">
                    {formatDistanceToNow(new Date(contact.created_at), { addSuffix: true })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Activity Feed */}
        <div className="glass-card p-5">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Recent Activity</h2>
          {activities.length === 0 ? (
            <div className="text-center py-6">
              <Clock size={28} className="mx-auto text-slate-300 mb-2" />
              <p className="text-slate-400 text-sm">No recent activity</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {activities.map((activity) => (
                <div key={activity.id} className="flex gap-3 p-3 rounded-xl bg-white/50 border border-slate-100">
                  <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${activity.type === 'note' ? 'bg-blue-500' : 'bg-emerald-500'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-800 text-sm truncate">{activity.description}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-slate-400 text-xs capitalize">{activity.type}</span>
                      <span className="text-slate-300">·</span>
                      <span className="text-slate-400 text-xs">
                        {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Deals */}
      {recentDeals.length > 0 && (
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Recent Deals</h2>
            <button
              onClick={() => navigate('/pipeline')}
              className="text-indigo-600 hover:text-indigo-700 text-sm font-medium transition-colors cursor-pointer"
            >
              View Pipeline
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200/60">
                  <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider pb-3 pr-4">Deal</th>
                  <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider pb-3 pr-4">Value</th>
                  <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider pb-3 pr-4">Stage</th>
                  <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider pb-3">Added</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentDeals.map((deal) => (
                  <tr
                    key={deal.id}
                    className="hover:bg-indigo-50/30 cursor-pointer transition-colors"
                    onClick={() => navigate('/pipeline')}
                  >
                    <td className="py-3 pr-4">
                      <p className="text-slate-800 text-sm font-medium">{deal.title}</p>
                    </td>
                    <td className="py-3 pr-4 text-slate-700 text-sm font-medium">
                      {deal.value ? `£${deal.value.toLocaleString()}` : '—'}
                    </td>
                    <td className="py-3 pr-4">
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 capitalize">
                        {deal.stage || 'Lead'}
                      </span>
                    </td>
                    <td className="py-3 text-slate-400 text-xs">
                      {formatDistanceToNow(new Date(deal.created_at), { addSuffix: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
