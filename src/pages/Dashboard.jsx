import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  getColorFromHash, getInitials, getPriorityColor, getDueDateInfo,
  formatRelativeDate, formatCurrency, getContactFullName,
} from '../lib/utils';
import {
  Users, TrendingUp, CheckSquare, PoundSterling, Clock, Plus,
  ArrowUpRight, ArrowDownRight, UserPlus, ListPlus, DollarSign,
  AlertTriangle, FileText, MessageSquare, Zap, Target,
} from 'lucide-react';
import { formatDistanceToNow, format, isToday, isPast, parseISO, subDays } from 'date-fns';

function MiniSparkline({ data, color = '#6366f1', height = 32, width = 80 }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="flex-shrink-0">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SkeletonLoader() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card p-5">
            <div className="skeleton h-4 w-20 mb-3" />
            <div className="skeleton h-8 w-16 mb-2" />
            <div className="skeleton h-3 w-24" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="card p-5">
            <div className="skeleton h-5 w-32 mb-4" />
            {[...Array(3)].map((_, j) => (
              <div key={j} className="skeleton h-12 w-full mb-3" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState({
    contacts: [], deals: [], tasks: [], notes: [], interactions: [], stages: [],
  });
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
        supabase.from('notes').select('*').order('created_at', { ascending: false }).limit(10),
        supabase.from('interactions').select('*').order('created_at', { ascending: false }).limit(10),
        supabase.from('pipeline_stages').select('*').order('position', { ascending: true }),
      ]);

      setData({
        contacts: contactsRes.data || [],
        deals: dealsRes.data || [],
        tasks: tasksRes.data || [],
        notes: notesRes.data || [],
        interactions: interactionsRes.data || [],
        stages: stagesRes.data || [],
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const { contacts, deals, tasks } = data;
    const activeDeals = deals.filter(d => d.status === 'active' || !d.status);
    const pipelineValue = activeDeals.reduce((sum, d) => sum + (d.value || 0), 0);
    const pendingTasks = tasks.filter(t => t.status !== 'Completed' && t.status !== 'Cancelled');

    // Weekly trends (items created in last 7 days)
    const weekAgo = subDays(new Date(), 7);
    const newContactsThisWeek = contacts.filter(c => new Date(c.created_at) > weekAgo).length;
    const newDealsThisWeek = deals.filter(d => new Date(d.created_at) > weekAgo).length;

    // Sparkline data: count per day for last 7 days
    const sparklineData = (items) => {
      const days = Array(7).fill(0);
      items.forEach(item => {
        const created = new Date(item.created_at);
        const daysAgo = Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24));
        if (daysAgo >= 0 && daysAgo < 7) {
          days[6 - daysAgo]++;
        }
      });
      return days;
    };

    return {
      contacts: contacts.length,
      activeDeals: activeDeals.length,
      pendingTasks: pendingTasks.length,
      pipelineValue,
      newContactsThisWeek,
      newDealsThisWeek,
      contactSparkline: sparklineData(contacts),
      dealSparkline: sparklineData(deals),
      taskSparkline: sparklineData(tasks),
    };
  }, [data]);

  const pipelineFunnel = useMemo(() => {
    const { deals, stages } = data;
    const activeDeals = deals.filter(d => d.status === 'active' || !d.status);
    return stages.map(stage => {
      const stageDeals = activeDeals.filter(d => d.stage === stage.name);
      return {
        name: stage.name,
        color: stage.color || '#6366f1',
        count: stageDeals.length,
        value: stageDeals.reduce((sum, d) => sum + (d.value || 0), 0),
      };
    });
  }, [data]);

  const actionItems = useMemo(() => {
    const { tasks, deals } = data;
    const items = [];

    // Overdue tasks
    tasks.forEach(t => {
      if (t.status === 'Completed' || t.status === 'Cancelled') return;
      if (t.due_date && isPast(parseISO(t.due_date)) && !isToday(parseISO(t.due_date))) {
        items.push({
          id: `task-${t.id}`,
          type: 'overdue_task',
          title: t.title,
          subtitle: `Overdue: ${format(parseISO(t.due_date), 'MMM d')}`,
          priority: t.priority,
          severity: 'red',
        });
      }
    });

    // Tasks due today
    tasks.forEach(t => {
      if (t.status === 'Completed' || t.status === 'Cancelled') return;
      if (t.due_date && isToday(parseISO(t.due_date))) {
        items.push({
          id: `task-today-${t.id}`,
          type: 'today_task',
          title: t.title,
          subtitle: 'Due today',
          priority: t.priority,
          severity: 'amber',
        });
      }
    });

    return items.slice(0, 6);
  }, [data]);

  const recentActivity = useMemo(() => {
    const { notes, interactions } = data;
    return [
      ...notes.map(n => ({
        id: `note-${n.id}`,
        type: 'note',
        icon: FileText,
        description: n.content?.substring(0, 80) + (n.content?.length > 80 ? '...' : ''),
        created_at: n.created_at,
      })),
      ...interactions.map(i => ({
        id: `interaction-${i.id}`,
        type: 'interaction',
        icon: MessageSquare,
        description: i.subject || i.content?.substring(0, 80) || 'Interaction logged',
        created_at: i.created_at,
        channel: i.channel,
      })),
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 8);
  }, [data]);

  const quickStats = useMemo(() => {
    const { contacts, deals, tasks } = data;
    const totalDeals = deals.length;
    const wonDeals = deals.filter(d => d.status === 'won').length;
    const avgDealValue = deals.length > 0
      ? deals.reduce((sum, d) => sum + (d.value || 0), 0) / deals.length
      : 0;
    const completedTasks = tasks.filter(t => t.status === 'Completed').length;
    const totalTasks = tasks.length;

    return {
      conversionRate: totalDeals > 0 ? Math.round((wonDeals / totalDeals) * 100) : 0,
      avgDealValue,
      taskCompletionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      totalContacts: contacts.length,
    };
  }, [data]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="skeleton h-8 w-48 mb-2" />
          <div className="skeleton h-4 w-64" />
        </div>
        <SkeletonLoader />
      </div>
    );
  }

  const statCards = [
    {
      label: 'Total Contacts', value: stats.contacts, icon: Users,
      iconBg: 'bg-primary-50', iconColor: 'text-primary-600',
      trend: stats.newContactsThisWeek > 0 ? `+${stats.newContactsThisWeek} this week` : null,
      trendUp: true, sparkline: stats.contactSparkline, nav: '/contacts',
    },
    {
      label: 'Active Deals', value: stats.activeDeals, icon: TrendingUp,
      iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600',
      trend: stats.newDealsThisWeek > 0 ? `+${stats.newDealsThisWeek} this week` : null,
      trendUp: true, sparkline: stats.dealSparkline, nav: '/pipeline',
    },
    {
      label: 'Pending Tasks', value: stats.pendingTasks, icon: CheckSquare,
      iconBg: 'bg-amber-50', iconColor: 'text-amber-600',
      trend: null, sparkline: stats.taskSparkline, nav: '/tasks',
    },
    {
      label: 'Pipeline Value', value: formatCurrency(stats.pipelineValue), icon: PoundSterling,
      iconBg: 'bg-violet-50', iconColor: 'text-violet-600',
      trend: null, sparkline: null, nav: '/pipeline',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Dashboard</h1>
          <p className="text-text-muted text-sm mt-0.5">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => navigate('/contacts?action=new')} className="btn-secondary text-xs py-1.5 px-3">
          <UserPlus size={14} /> New Contact
        </button>
        <button onClick={() => navigate('/pipeline?action=new')} className="btn-secondary text-xs py-1.5 px-3">
          <DollarSign size={14} /> New Deal
        </button>
        <button onClick={() => navigate('/tasks?action=new')} className="btn-secondary text-xs py-1.5 px-3">
          <ListPlus size={14} /> New Task
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="card card-interactive p-5 cursor-pointer"
              onClick={() => navigate(card.nav)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-text-muted text-[10px] sm:text-xs font-medium uppercase tracking-wide truncate">{card.label}</p>
                  <p className="text-xl sm:text-2xl font-bold text-text mt-1">{card.value}</p>
                  {card.trend && (
                    <p className="text-[10px] sm:text-xs text-emerald-600 mt-1 flex items-center gap-1">
                      <ArrowUpRight size={12} />
                      {card.trend}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className={`${card.iconBg} p-1.5 sm:p-2 rounded-lg`}>
                    <Icon size={16} className={`${card.iconColor} sm:w-[18px] sm:h-[18px]`} />
                  </div>
                  <div className="hidden sm:block">
                    {card.sparkline && <MiniSparkline data={card.sparkline} />}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pipeline Funnel */}
      {pipelineFunnel.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-text">Pipeline Overview</h2>
            <button
              onClick={() => navigate('/pipeline')}
              className="text-primary-600 hover:text-primary-700 text-xs font-medium transition-colors cursor-pointer"
            >
              View Pipeline
            </button>
          </div>
          <div className="flex gap-1 h-10 rounded-lg overflow-hidden">
            {pipelineFunnel.map((stage, i) => {
              const totalDeals = pipelineFunnel.reduce((sum, s) => sum + s.count, 0);
              const width = totalDeals > 0 ? Math.max((stage.count / totalDeals) * 100, stage.count > 0 ? 8 : 2) : 100 / pipelineFunnel.length;
              return (
                <div
                  key={stage.name}
                  className="flex items-center justify-center transition-all duration-200 hover:opacity-80 cursor-pointer group relative"
                  style={{ width: `${width}%`, backgroundColor: stage.color + '20', borderLeft: i > 0 ? '2px solid white' : 'none' }}
                  onClick={() => navigate('/pipeline')}
                >
                  <div className="absolute -top-12 left-1/2 -translate-x-1/2 card px-2 py-1 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-10 pointer-events-none">
                    <span className="font-medium">{stage.name}</span>: {stage.count} deals · {formatCurrency(stage.value)}
                  </div>
                  {stage.count > 0 && (
                    <span className="text-xs font-medium" style={{ color: stage.color }}>{stage.count}</span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex gap-3 mt-3 flex-wrap">
            {pipelineFunnel.filter(s => s.count > 0).map(stage => (
              <div key={stage.name} className="flex items-center gap-1.5 text-xs text-text-muted">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
                {stage.name} ({stage.count})
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Action Required */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-text flex items-center gap-2">
              <AlertTriangle size={14} className="text-amber-500" />
              Action Required
            </h2>
            <button
              onClick={() => navigate('/tasks')}
              className="text-primary-600 hover:text-primary-700 text-xs font-medium transition-colors cursor-pointer"
            >
              View All
            </button>
          </div>
          {actionItems.length === 0 ? (
            <div className="text-center py-6">
              <CheckSquare size={24} className="mx-auto text-text-subtle mb-2" />
              <p className="text-text-subtle text-sm">All caught up</p>
            </div>
          ) : (
            <div className="space-y-2">
              {actionItems.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors hover:bg-surface ${
                    item.severity === 'red' ? 'border-red-200 bg-red-50/50' : 'border-amber-200 bg-amber-50/50'
                  }`}
                  onClick={() => navigate('/tasks')}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-text text-sm font-medium truncate">{item.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs ${item.severity === 'red' ? 'text-red-600' : 'text-amber-600'}`}>
                        {item.subtitle}
                      </span>
                      <span className={`badge ${getPriorityColor(item.priority)}`}>
                        {item.priority || 'Medium'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-text mb-4">Recent Activity</h2>
          {recentActivity.length === 0 ? (
            <div className="text-center py-6">
              <Clock size={24} className="mx-auto text-text-subtle mb-2" />
              <p className="text-text-subtle text-sm">No recent activity</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentActivity.map((activity) => {
                const Icon = activity.icon;
                return (
                  <div key={activity.id} className="flex gap-3 p-2.5 rounded-lg hover:bg-surface transition-colors">
                    <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${
                      activity.type === 'note' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'
                    }`}>
                      <Icon size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-text text-sm truncate">{activity.description}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-text-subtle text-xs capitalize">{activity.type}</span>
                        <span className="text-text-subtle text-xs">
                          {formatRelativeDate(activity.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-text mb-4 flex items-center gap-2">
            <Target size={14} className="text-primary-500" />
            Quick Stats
          </h2>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm text-text-muted">Win Rate</span>
                <span className="text-sm font-semibold text-text">{quickStats.conversionRate}%</span>
              </div>
              <div className="h-2 bg-surface rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${quickStats.conversionRate}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm text-text-muted">Task Completion</span>
                <span className="text-sm font-semibold text-text">{quickStats.taskCompletionRate}%</span>
              </div>
              <div className="h-2 bg-surface rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 rounded-full transition-all duration-500"
                  style={{ width: `${quickStats.taskCompletionRate}%` }}
                />
              </div>
            </div>
            <div className="pt-2 border-t border-border-subtle">
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-text-muted">Avg Deal Value</span>
                <span className="text-sm font-semibold text-text">{formatCurrency(quickStats.avgDealValue)}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-text-muted">Total Contacts</span>
                <span className="text-sm font-semibold text-text">{quickStats.totalContacts}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Contacts */}
      {data.contacts.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-text">Recent Contacts</h2>
            <button
              onClick={() => navigate('/contacts')}
              className="text-primary-600 hover:text-primary-700 text-xs font-medium transition-colors cursor-pointer"
            >
              View All
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {data.contacts.slice(0, 5).map((contact) => (
              <div
                key={contact.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-border-subtle hover:border-border-hover transition-colors cursor-pointer"
                onClick={() => navigate(`/contacts/${contact.id}`)}
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold text-xs flex-shrink-0"
                  style={{ backgroundColor: getColorFromHash(`${contact.first_name}${contact.last_name}`) }}
                >
                  {getInitials(contact.first_name, contact.last_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-text text-sm font-medium truncate">
                    {contact.first_name} {contact.last_name}
                  </p>
                  <p className="text-text-subtle text-xs truncate">
                    {contact.company || contact.email || 'No details'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
