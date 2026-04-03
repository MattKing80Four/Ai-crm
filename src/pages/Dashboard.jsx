import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/Toast';
import {
  getColorFromHash, getInitials, getPriorityColor, getDueDateInfo,
  formatRelativeDate, formatCurrency, getContactFullName, getStaleContacts,
  getDealsClosingThisWeek, getTaskTypeInfo, getTaskTypeColor,
} from '../lib/utils';
import {
  Users, TrendingUp, CheckSquare, PoundSterling, Clock, Plus,
  ArrowUpRight, ArrowDownRight, UserPlus, ListPlus, DollarSign,
  AlertTriangle, FileText, MessageSquare, Zap, Target, CalendarDays,
  CheckCircle2, Circle, ChevronRight, Phone, Mail, ExternalLink,
  Calendar, RotateCcw, User,
} from 'lucide-react';
import { formatDistanceToNow, format, isToday, isPast, parseISO, subDays, addDays, startOfDay, isSameDay } from 'date-fns';

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
      <div className="card p-5">
        <div className="skeleton h-6 w-48 mb-4" />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="skeleton h-14 w-full mb-3 rounded-lg" />
        ))}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card p-5">
            <div className="skeleton h-4 w-20 mb-3" />
            <div className="skeleton h-8 w-16 mb-2" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const toast = useToast();
  const [data, setData] = useState({
    contacts: [], deals: [], tasks: [], notes: [], interactions: [], stages: [],
  });
  const [loading, setLoading] = useState(true);
  const [completingTaskId, setCompletingTaskId] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);

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
        supabase.from('notes').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('interactions').select('*').order('created_at', { ascending: false }).limit(50),
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

  // Inline task completion
  const handleToggleTask = useCallback(async (task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    setCompletingTaskId(task.id);

    // Optimistic update
    setData(prev => ({
      ...prev,
      tasks: prev.tasks.map(t =>
        t.id === task.id
          ? { ...t, status: newStatus, completed_at: newStatus === 'completed' ? new Date().toISOString() : null }
          : t
      ),
    }));

    try {
      const { error } = await supabase.from('tasks').update({
        status: newStatus,
        completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
      }).eq('id', task.id);
      if (error) throw error;
      toast.success(newStatus === 'completed' ? 'Task completed' : 'Task reopened');
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('Failed to update task');
      fetchDashboardData(); // revert
    } finally {
      setTimeout(() => setCompletingTaskId(null), 300);
    }
  }, [toast]);

  // ─── Today's Agenda Items ───
  const todaysTasks = useMemo(() => {
    return data.tasks.filter(t => {
      if (t.status === 'completed' || t.status === 'cancelled') return false;
      return t.due_date && isToday(parseISO(t.due_date));
    });
  }, [data.tasks]);

  const overdueTasks = useMemo(() => {
    return data.tasks.filter(t => {
      if (t.status === 'completed' || t.status === 'cancelled') return false;
      return t.due_date && isPast(parseISO(t.due_date)) && !isToday(parseISO(t.due_date));
    });
  }, [data.tasks]);

  const dealsClosingThisWeek = useMemo(() => {
    return getDealsClosingThisWeek(data.deals);
  }, [data.deals]);

  const staleContacts = useMemo(() => {
    return getStaleContacts(data.contacts, data.notes, data.interactions, data.tasks);
  }, [data.contacts, data.notes, data.interactions, data.tasks]);

  // ─── Week Calendar Strip ───
  const weekDays = useMemo(() => {
    const today = startOfDay(new Date());
    return Array.from({ length: 7 }, (_, i) => {
      const day = addDays(today, i);
      const dayTasks = data.tasks.filter(t =>
        t.due_date && isSameDay(parseISO(t.due_date), day) &&
        t.status !== 'completed' && t.status !== 'cancelled'
      );
      const dayDeals = data.deals.filter(d =>
        d.expected_close_date && isSameDay(parseISO(d.expected_close_date), day) &&
        d.status !== 'won' && d.status !== 'lost'
      );
      return { date: day, tasks: dayTasks, deals: dayDeals, total: dayTasks.length + dayDeals.length };
    });
  }, [data.tasks, data.deals]);

  const selectedDayItems = useMemo(() => {
    if (!selectedDay) return null;
    const dayData = weekDays.find(d => isSameDay(d.date, selectedDay));
    return dayData || null;
  }, [selectedDay, weekDays]);

  // ─── Stats ───
  const stats = useMemo(() => {
    const { contacts, deals, tasks } = data;
    const activeDeals = deals.filter(d => d.status === 'active' || d.status === 'open' || !d.status);
    const pipelineValue = activeDeals.reduce((sum, d) => sum + (parseFloat(d.value) || 0), 0);
    const pendingTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled');
    const weekAgo = subDays(new Date(), 7);
    const newContactsThisWeek = contacts.filter(c => new Date(c.created_at) > weekAgo).length;
    const newDealsThisWeek = deals.filter(d => new Date(d.created_at) > weekAgo).length;

    const sparklineData = (items) => {
      const days = Array(7).fill(0);
      items.forEach(item => {
        const created = new Date(item.created_at);
        const daysAgo = Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24));
        if (daysAgo >= 0 && daysAgo < 7) days[6 - daysAgo]++;
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
    const activeDeals = deals.filter(d => d.status === 'active' || d.status === 'open' || !d.status);
    return stages.map(stage => {
      const stageDeals = activeDeals.filter(d => d.stage_id === stage.id);
      return {
        name: stage.name,
        color: stage.color || '#6366f1',
        count: stageDeals.length,
        value: stageDeals.reduce((sum, d) => sum + (parseFloat(d.value) || 0), 0),
      };
    });
  }, [data]);

  const quickStats = useMemo(() => {
    const { deals, tasks } = data;
    const totalDeals = deals.length;
    const wonDeals = deals.filter(d => d.status === 'won').length;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const totalTasks = tasks.length;
    return {
      conversionRate: totalDeals > 0 ? Math.round((wonDeals / totalDeals) * 100) : 0,
      taskCompletionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
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

  const agendaCount = todaysTasks.length + overdueTasks.length;
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
      sparkline: stats.taskSparkline, nav: '/tasks',
    },
    {
      label: 'Pipeline Value', value: formatCurrency(stats.pipelineValue), icon: PoundSterling,
      iconBg: 'bg-violet-50', iconColor: 'text-violet-600',
      nav: '/pipeline',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">
            {new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening'}
          </h1>
          <p className="text-text-muted text-sm mt-0.5">
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
            {agendaCount > 0 && <span className="ml-2 text-amber-600 font-medium">· {agendaCount} item{agendaCount !== 1 ? 's' : ''} need attention</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate('/contacts?action=new')} className="btn-secondary text-xs hidden sm:inline-flex">
            <UserPlus size={14} /> Contact
          </button>
          <button onClick={() => navigate('/pipeline?action=new')} className="btn-secondary text-xs hidden sm:inline-flex">
            <DollarSign size={14} /> Deal
          </button>
          <button onClick={() => navigate('/tasks?action=new')} className="btn-primary text-xs">
            <Plus size={14} /> New Task
          </button>
        </div>
      </div>

      {/* ─── TODAY'S AGENDA ─── */}
      {(overdueTasks.length > 0 || todaysTasks.length > 0) && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-text flex items-center gap-2">
              <Zap size={15} className="text-amber-500" />
              Today's Agenda
              <span className="text-xs font-normal text-text-muted">
                ({agendaCount} item{agendaCount !== 1 ? 's' : ''})
              </span>
            </h2>
            <button onClick={() => navigate('/tasks')} className="text-primary-600 hover:text-primary-700 text-xs font-medium transition-colors cursor-pointer">
              All Tasks
            </button>
          </div>

          {/* Overdue Tasks */}
          {overdueTasks.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-medium text-red-600 mb-2 flex items-center gap-1.5">
                <AlertTriangle size={12} />
                Overdue ({overdueTasks.length})
              </p>
              <div className="space-y-1.5">
                {overdueTasks.slice(0, 5).map(task => (
                  <TaskAgendaRow
                    key={task.id}
                    task={task}
                    contacts={data.contacts}
                    onToggle={handleToggleTask}
                    isCompleting={completingTaskId === task.id}
                    variant="overdue"
                    navigate={navigate}
                  />
                ))}
                {overdueTasks.length > 5 && (
                  <button onClick={() => navigate('/tasks')} className="text-xs text-red-600 hover:text-red-700 font-medium cursor-pointer pl-8">
                    +{overdueTasks.length - 5} more overdue
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Today's Tasks */}
          {todaysTasks.length > 0 && (
            <div>
              {overdueTasks.length > 0 && <div className="border-t border-border-subtle my-3" />}
              <p className="text-xs font-medium text-amber-600 mb-2 flex items-center gap-1.5">
                <CalendarDays size={12} />
                Due Today ({todaysTasks.length})
              </p>
              <div className="space-y-1.5">
                {todaysTasks.map(task => (
                  <TaskAgendaRow
                    key={task.id}
                    task={task}
                    contacts={data.contacts}
                    onToggle={handleToggleTask}
                    isCompleting={completingTaskId === task.id}
                    variant="today"
                    navigate={navigate}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* All caught up state */}
      {overdueTasks.length === 0 && todaysTasks.length === 0 && (
        <div className="card p-5 text-center">
          <CheckCircle2 size={28} className="mx-auto text-emerald-500 mb-2" />
          <p className="text-text font-medium text-sm">All caught up for today</p>
          <p className="text-text-subtle text-xs mt-0.5">No overdue or due-today tasks. Nice work.</p>
        </div>
      )}

      {/* ─── WEEK CALENDAR STRIP ─── */}
      <div className="card p-4">
        <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">Next 7 Days</h2>
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day, i) => {
            const isSelected = selectedDay && isSameDay(day.date, selectedDay);
            const isTodayDay = i === 0;
            return (
              <button
                key={i}
                onClick={() => setSelectedDay(isSelected ? null : day.date)}
                className={`flex flex-col items-center py-2 px-1 rounded-lg transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-primary-600 text-white'
                    : isTodayDay
                    ? 'bg-primary-50 text-primary-700 border border-primary-200'
                    : 'hover:bg-surface border border-transparent'
                }`}
              >
                <span className={`text-[10px] font-medium ${isSelected ? 'text-primary-100' : 'text-text-subtle'}`}>
                  {format(day.date, 'EEE')}
                </span>
                <span className={`text-lg font-bold ${isSelected ? 'text-white' : 'text-text'}`}>
                  {format(day.date, 'd')}
                </span>
                {day.total > 0 && (
                  <div className="flex gap-0.5 mt-1">
                    {day.tasks.length > 0 && (
                      <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-amber-400'}`} />
                    )}
                    {day.deals.length > 0 && (
                      <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-emerald-400'}`} />
                    )}
                  </div>
                )}
                {day.total === 0 && <div className="h-[14px]" />}
              </button>
            );
          })}
        </div>

        {/* Selected Day Details */}
        {selectedDayItems && (
          <div className="mt-3 pt-3 border-t border-border-subtle">
            <p className="text-xs font-medium text-text-muted mb-2">
              {format(selectedDay, 'EEEE, MMM d')} — {selectedDayItems.total} item{selectedDayItems.total !== 1 ? 's' : ''}
            </p>
            {selectedDayItems.tasks.map(task => (
              <div key={task.id} className="flex items-center gap-3 py-1.5 text-sm">
                <CheckSquare size={13} className="text-amber-500 flex-shrink-0" />
                <span className="text-text truncate">{task.title}</span>
                <span className={`badge ${getPriorityColor(task.priority)} ml-auto`}>{task.priority}</span>
              </div>
            ))}
            {selectedDayItems.deals.map(deal => (
              <div key={deal.id} className="flex items-center gap-3 py-1.5 text-sm">
                <TrendingUp size={13} className="text-emerald-500 flex-shrink-0" />
                <span className="text-text truncate">{deal.title}</span>
                <span className="text-text-muted text-xs ml-auto">{formatCurrency(deal.value)}</span>
              </div>
            ))}
            {selectedDayItems.total === 0 && (
              <p className="text-text-subtle text-xs">Nothing scheduled</p>
            )}
          </div>
        )}
      </div>

      {/* ─── STAT CARDS ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="card card-interactive p-5 cursor-pointer" onClick={() => navigate(card.nav)}>
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

      {/* ─── PIPELINE + NEEDS ATTENTION + DEALS CLOSING ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Deals Closing This Week */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-text flex items-center gap-2">
              <Calendar size={14} className="text-emerald-500" />
              Closing This Week
            </h2>
            <button onClick={() => navigate('/pipeline')} className="text-primary-600 hover:text-primary-700 text-xs font-medium transition-colors cursor-pointer">
              Pipeline
            </button>
          </div>
          {dealsClosingThisWeek.length === 0 ? (
            <div className="text-center py-6">
              <TrendingUp size={24} className="mx-auto text-text-subtle mb-2" />
              <p className="text-text-subtle text-sm">No deals closing this week</p>
            </div>
          ) : (
            <div className="space-y-2">
              {dealsClosingThisWeek.map(deal => {
                const contactName = data.contacts.find(c => c.id === deal.contact_id);
                return (
                  <div
                    key={deal.id}
                    className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-surface transition-colors cursor-pointer"
                    onClick={() => navigate('/pipeline')}
                  >
                    <div className="w-1.5 h-8 rounded-full bg-emerald-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-text text-sm font-medium truncate">{deal.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-text-subtle">
                          Closes {format(parseISO(deal.expected_close_date), 'EEE, MMM d')}
                        </span>
                        {contactName && (
                          <span className="text-xs text-text-subtle flex items-center gap-1">
                            <User size={10} /> {getContactFullName(contactName)}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-text font-semibold text-sm">{formatCurrency(deal.value)}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Needs Attention - Stale Contacts */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-text flex items-center gap-2">
              <AlertTriangle size={14} className="text-amber-500" />
              Needs Follow-Up
            </h2>
            <button onClick={() => navigate('/contacts')} className="text-primary-600 hover:text-primary-700 text-xs font-medium transition-colors cursor-pointer">
              Contacts
            </button>
          </div>
          {staleContacts.length === 0 ? (
            <div className="text-center py-6">
              <CheckCircle2 size={24} className="mx-auto text-emerald-500 mb-2" />
              <p className="text-text-subtle text-sm">All contacts are engaged</p>
            </div>
          ) : (
            <div className="space-y-2">
              {staleContacts.slice(0, 5).map(contact => (
                <div
                  key={contact.id}
                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-surface transition-colors cursor-pointer group"
                  onClick={() => navigate(`/contacts/${contact.id}`)}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-xs flex-shrink-0"
                    style={{ backgroundColor: getColorFromHash(`${contact.first_name}${contact.last_name}`) }}
                  >
                    {getInitials(contact.first_name, contact.last_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-text text-sm font-medium truncate">
                      {contact.first_name} {contact.last_name}
                    </p>
                    <p className="text-text-subtle text-xs">
                      {contact.daysSince} days since last activity
                    </p>
                  </div>
                  <div className="flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    {contact.email && (
                      <a
                        href={`mailto:${contact.email}`}
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 rounded-md hover:bg-primary-50 text-text-subtle hover:text-primary-600 transition-colors"
                        title="Send email"
                      >
                        <Mail size={13} />
                      </a>
                    )}
                    {contact.phone && (
                      <a
                        href={`tel:${contact.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 rounded-md hover:bg-primary-50 text-text-subtle hover:text-primary-600 transition-colors"
                        title="Call"
                      >
                        <Phone size={13} />
                      </a>
                    )}
                  </div>
                </div>
              ))}
              {staleContacts.length > 5 && (
                <button onClick={() => navigate('/contacts')} className="text-xs text-primary-600 hover:text-primary-700 font-medium cursor-pointer w-full text-center pt-1">
                  +{staleContacts.length - 5} more need follow-up
                </button>
              )}
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-text mb-4 flex items-center gap-2">
            <Target size={14} className="text-primary-500" />
            Performance
          </h2>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm text-text-muted">Win Rate</span>
                <span className="text-sm font-semibold text-text">{quickStats.conversionRate}%</span>
              </div>
              <div className="h-2 bg-surface rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${quickStats.conversionRate}%` }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm text-text-muted">Task Completion</span>
                <span className="text-sm font-semibold text-text">{quickStats.taskCompletionRate}%</span>
              </div>
              <div className="h-2 bg-surface rounded-full overflow-hidden">
                <div className="h-full bg-primary-500 rounded-full transition-all duration-500" style={{ width: `${quickStats.taskCompletionRate}%` }} />
              </div>
            </div>

            {/* Pipeline Funnel Mini */}
            {pipelineFunnel.length > 0 && (
              <div className="pt-3 border-t border-border-subtle">
                <p className="text-xs font-medium text-text-muted mb-2">Pipeline</p>
                <div className="flex gap-1 h-6 rounded-lg overflow-hidden mb-2">
                  {pipelineFunnel.map((stage, i) => {
                    const totalDeals = pipelineFunnel.reduce((sum, s) => sum + s.count, 0);
                    const width = totalDeals > 0 ? Math.max((stage.count / totalDeals) * 100, stage.count > 0 ? 10 : 3) : 100 / pipelineFunnel.length;
                    return (
                      <div
                        key={stage.name}
                        className="flex items-center justify-center transition-all duration-200 cursor-pointer"
                        style={{ width: `${width}%`, backgroundColor: stage.color + '30' }}
                        onClick={() => navigate('/pipeline')}
                        title={`${stage.name}: ${stage.count} deals · ${formatCurrency(stage.value)}`}
                      >
                        {stage.count > 0 && (
                          <span className="text-[10px] font-bold" style={{ color: stage.color }}>{stage.count}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {pipelineFunnel.filter(s => s.count > 0).map(stage => (
                    <div key={stage.name} className="flex items-center gap-1 text-[10px] text-text-subtle">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: stage.color }} />
                      {stage.name}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── RECENT CONTACTS ─── */}
      {data.contacts.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-text">Recent Contacts</h2>
            <button onClick={() => navigate('/contacts')} className="text-primary-600 hover:text-primary-700 text-xs font-medium transition-colors cursor-pointer">
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

// ─── Task Agenda Row Component ───
function TaskAgendaRow({ task, contacts, onToggle, isCompleting, variant, navigate }) {
  const contactName = task.contact_id
    ? contacts.find(c => c.id === task.contact_id)
    : null;
  const typeInfo = getTaskTypeInfo(task.type);

  return (
    <div
      className={`flex items-center gap-3 p-2.5 rounded-lg transition-all ${
        isCompleting ? 'opacity-50 scale-[0.98]' : ''
      } ${
        variant === 'overdue'
          ? 'bg-red-50/50 border border-red-100 hover:bg-red-50'
          : 'hover:bg-surface border border-transparent'
      }`}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onToggle(task); }}
        className="flex-shrink-0 cursor-pointer group"
        title="Mark complete"
      >
        <Circle
          size={18}
          className={`transition-colors ${
            variant === 'overdue'
              ? 'text-red-300 group-hover:text-emerald-500'
              : 'text-border-hover group-hover:text-emerald-500'
          }`}
        />
      </button>

      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate('/tasks')}>
        <div className="flex items-center gap-2">
          <p className="text-text text-sm font-medium truncate">{task.title}</p>
          <span className={`badge ${getTaskTypeColor(task.type)} hidden sm:inline-flex`}>
            {typeInfo.icon} {typeInfo.label}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {variant === 'overdue' && task.due_date && (
            <span className="text-xs text-red-600">
              {format(parseISO(task.due_date), 'MMM d')}
            </span>
          )}
          <span className={`badge ${getPriorityColor(task.priority)}`}>
            {(task.priority || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </span>
          {contactName && (
            <span className="text-xs text-text-subtle flex items-center gap-1 hidden sm:inline-flex">
              <User size={10} /> {getContactFullName(contactName)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
