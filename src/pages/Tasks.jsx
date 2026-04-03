import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';
import {
  getPriorityColor, getDueDateInfo, findContactName, findDealTitle,
  formatRelativeDate, getTaskStats, getTaskTypeInfo, getTaskTypeColor, TASK_TYPES,
} from '../lib/utils';
import {
  Plus, Edit2, Trash2, Search, List, Kanban, CalendarDays,
  ChevronLeft, ChevronRight, AlertTriangle, Clock, CheckCircle2, Tag, User,
} from 'lucide-react';
import {
  format, isToday, isPast, isThisWeek, parseISO, startOfMonth, endOfMonth,
  eachDayOfInterval, startOfWeek, endOfWeek, addMonths, subMonths, isSameMonth, isSameDay,
} from 'date-fns';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

const STATUSES = ['pending', 'in_progress', 'completed', 'cancelled'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const displayLabel = (val) => val ? val.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '';

export default function Tasks() {
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const [tasks, setTasks] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [saving, setSaving] = useState(false);

  const [viewMode, setViewMode] = useState(() => localStorage.getItem('tasks-view') || 'list');
  const [statusFilter, setStatusFilter] = useState(() => localStorage.getItem('tasks-status-filter') || 'All');
  const [priorityFilter, setPriorityFilter] = useState(() => localStorage.getItem('tasks-priority-filter') || 'All');
  const [contactFilter, setContactFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState(() => localStorage.getItem('tasks-type-filter') || 'All');
  const [sortBy, setSortBy] = useState(() => localStorage.getItem('tasks-sort') || 'Due Date');
  const [searchQuery, setSearchQuery] = useState('');
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [quickAddText, setQuickAddText] = useState('');

  const [formData, setFormData] = useState({
    title: '', description: '', contact_id: '', deal_id: '',
    priority: 'medium', due_date: '', status: 'pending', type: 'other',
  });

  useEffect(() => {
    fetchTasks(); fetchContacts(); fetchDeals();
  }, []);

  useEffect(() => {
    if (searchParams.get('action') === 'new') setShowModal(true);
  }, [searchParams]);

  useEffect(() => {
    localStorage.setItem('tasks-view', viewMode);
    localStorage.setItem('tasks-status-filter', statusFilter);
    localStorage.setItem('tasks-priority-filter', priorityFilter);
    localStorage.setItem('tasks-type-filter', typeFilter);
    localStorage.setItem('tasks-sort', sortBy);
  }, [viewMode, statusFilter, priorityFilter, typeFilter, sortBy]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('tasks').select('*').order('due_date', { ascending: true });
      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const fetchContacts = async () => {
    const { data } = await supabase.from('contacts').select('id, first_name, last_name').order('first_name');
    setContacts(data || []);
  };

  const fetchDeals = async () => {
    const { data } = await supabase.from('deals').select('id, title').order('title');
    setDeals(data || []);
  };

  const filteredTasks = useMemo(() => {
    return tasks
      .filter(t => {
        if (statusFilter !== 'All' && t.status !== statusFilter) return false;
        if (priorityFilter !== 'All' && t.priority !== priorityFilter) return false;
        if (contactFilter !== 'All' && t.contact_id !== contactFilter) return false;
        if (typeFilter !== 'All' && (t.type || 'other') !== typeFilter) return false;
        if (searchQuery && !t.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'Due Date') return new Date(a.due_date || '2099-12-31') - new Date(b.due_date || '2099-12-31');
        if (sortBy === 'Created') return new Date(b.created_at) - new Date(a.created_at);
        if (sortBy === 'Priority') {
          const order = { Urgent: 0, High: 1, Medium: 2, Low: 3 };
          return (order[a.priority] ?? 2) - (order[b.priority] ?? 2);
        }
        if (sortBy === 'Type') return (a.type || 'other').localeCompare(b.type || 'other');
        return 0;
      });
  }, [tasks, statusFilter, priorityFilter, contactFilter, typeFilter, searchQuery, sortBy]);

  const stats = useMemo(() => getTaskStats(tasks), [tasks]);

  // Group tasks for list view
  const groupedTasks = useMemo(() => {
    const groups = { Overdue: [], Today: [], 'This Week': [], Later: [], 'No Date': [] };
    filteredTasks.forEach(t => {
      if (t.status === 'completed' || t.status === 'cancelled') {
        groups['Later'].push(t);
        return;
      }
      if (!t.due_date) { groups['No Date'].push(t); return; }
      const date = parseISO(t.due_date);
      if (isPast(date) && !isToday(date)) groups['Overdue'].push(t);
      else if (isToday(date)) groups['Today'].push(t);
      else if (isThisWeek(date)) groups['This Week'].push(t);
      else groups['Later'].push(t);
    });
    return Object.entries(groups).filter(([, items]) => items.length > 0);
  }, [filteredTasks]);

  // Board columns
  const boardColumns = useMemo(() => {
    const columns = { 'pending': [], 'in_progress': [], 'completed': [] };
    filteredTasks.filter(t => t.status !== 'cancelled').forEach(t => {
      if (columns[t.status]) columns[t.status].push(t);
      else columns['pending'].push(t);
    });
    return columns;
  }, [filteredTasks]);

  // Calendar data
  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(calendarMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(calendarMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [calendarMonth]);

  const tasksForDate = (date) => {
    return filteredTasks.filter(t => t.due_date && isSameDay(parseISO(t.due_date), date));
  };

  const calendarTaskCount = useMemo(() => {
    return filteredTasks.filter(t => t.due_date && isSameMonth(parseISO(t.due_date), calendarMonth)).length;
  }, [filteredTasks, calendarMonth]);

  const handleOpenModal = (task = null) => {
    if (task) {
      setEditingTask(task);
      setFormData({
        title: task.title, description: task.description || '',
        contact_id: task.contact_id || '', deal_id: task.deal_id || '',
        priority: task.priority || 'medium', due_date: task.due_date || '',
        status: task.status || 'pending', type: task.type || 'other',
      });
    } else {
      setEditingTask(null);
      setFormData({ title: '', description: '', contact_id: '', deal_id: '', priority: 'medium', due_date: '', status: 'pending', type: 'other' });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const taskData = {
        title: formData.title, description: formData.description || null,
        contact_id: formData.contact_id || null, deal_id: formData.deal_id || null,
        priority: formData.priority, due_date: formData.due_date || null,
        status: formData.status, type: formData.type || 'other',
      };
      if (editingTask) {
        const { error } = await supabase.from('tasks').update(taskData).eq('id', editingTask.id);
        if (error) throw error;
        toast.success('Task updated');
      } else {
        const { error } = await supabase.from('tasks').insert(taskData);
        if (error) throw error;
        toast.success('Task created');
      }
      fetchTasks();
      setShowModal(false);
      setEditingTask(null);
    } catch (error) {
      console.error('Error saving task:', error);
      toast.error(error.message || 'Failed to save task');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickAdd = async (e) => {
    if (e.key !== 'Enter' || !quickAddText.trim()) return;
    try {
      const { error } = await supabase.from('tasks').insert({ title: quickAddText.trim(), priority: 'medium', status: 'pending', type: 'other' });
      if (error) throw error;
      setQuickAddText('');
      toast.success('Task added');
      fetchTasks();
    } catch (error) {
      console.error('Error adding task:', error);
      toast.error('Failed to add task');
    }
  };

  const handleToggleCompleted = async (task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    const completedAt = newStatus === 'completed' ? new Date().toISOString() : null;
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus, completed_at: completedAt } : t));
    try {
      const { error } = await supabase.from('tasks').update({ status: newStatus, completed_at: completedAt }).eq('id', task.id);
      if (error) throw error;
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('Failed to update task');
      fetchTasks(); // revert
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Delete this task?')) return;
    try {
      const { error } = await supabase.from('tasks').delete().eq('id', taskId);
      if (error) throw error;
      toast.success('Task deleted');
      fetchTasks();
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error('Failed to delete task');
    }
  };

  const handleDragEnd = async (result) => {
    if (!result.destination) return;
    const taskId = result.draggableId;
    const destinationId = result.destination.droppableId;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    // Calendar drop (droppableId is a date like "2026-04-03")
    if (/^\d{4}-\d{2}-\d{2}$/.test(destinationId)) {
      const newDate = destinationId;
      if (task.due_date === newDate) return;
      // Optimistic
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, due_date: newDate } : t));
      try {
        const { error } = await supabase.from('tasks').update({ due_date: newDate }).eq('id', taskId);
        if (error) throw error;
        toast.success(`Moved to ${format(parseISO(newDate), 'MMM d')}`);
      } catch (error) {
        toast.error('Failed to move task');
        fetchTasks();
      }
      return;
    }

    // Board drop (droppableId is a status)
    const newStatus = destinationId;
    if (task.status === newStatus) return;
    const completedAt = newStatus === 'completed' ? new Date().toISOString() : null;
    // Optimistic
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus, completed_at: completedAt } : t));
    try {
      const { error } = await supabase.from('tasks').update({ status: newStatus, completed_at: completedAt }).eq('id', taskId);
      if (error) throw error;
    } catch (error) {
      console.error('Error moving task:', error);
      toast.error('Failed to move task');
      fetchTasks();
    }
  };

  const TaskItem = ({ task, compact = false }) => {
    const contactName = findContactName(contacts, task.contact_id);
    const dealTitle = findDealTitle(deals, task.deal_id);
    const dueInfo = getDueDateInfo(task.due_date);
    const typeInfo = getTaskTypeInfo(task.type);
    const isOverdue = task.due_date && isPast(parseISO(task.due_date)) && !isToday(parseISO(task.due_date)) && task.status !== 'completed' && task.status !== 'cancelled';
    const isDueToday = task.due_date && isToday(parseISO(task.due_date)) && task.status !== 'completed' && task.status !== 'cancelled';

    return (
      <div className={`flex items-start gap-3 p-3 rounded-lg transition-colors hover:bg-surface group border-l-3 ${
        task.status === 'completed' ? 'opacity-50' : ''
      } ${isOverdue ? 'border-l-red-400' : isDueToday ? 'border-l-amber-400' : `type-border-${task.type || 'other'}`}`}>
        <button
          onClick={() => handleToggleCompleted(task)}
          className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center transition-colors flex-shrink-0 mt-0.5 cursor-pointer ${
            task.status === 'completed' ? 'bg-primary-600 border-primary-600' : 'border-border-hover hover:border-primary-400'
          }`}
        >
          {task.status === 'completed' && (
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className={`text-sm font-medium ${task.status === 'completed' ? 'line-through text-text-subtle' : 'text-text'}`}>
              {task.title}
            </h3>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className={`badge ${getTaskTypeColor(task.type)}`}>
                {typeInfo.label}
              </span>
              <span className={`badge ${getPriorityColor(task.priority)}`}>
                {displayLabel(task.priority || 'medium')}
              </span>
            </div>
          </div>
          {!compact && task.description && (
            <p className="text-xs text-text-subtle mt-0.5 truncate">{task.description}</p>
          )}
          <div className="flex items-center gap-3 mt-1.5 text-xs flex-wrap">
            <span className={dueInfo.color}>{dueInfo.text}</span>
            {contactName && (
              <span className="text-text-muted flex items-center gap-1">
                <User size={10} /> {contactName}
              </span>
            )}
            {dealTitle && <span className="text-text-muted">{dealTitle}</span>}
          </div>
        </div>
        <div className="flex items-center gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button onClick={() => handleOpenModal(task)} className="p-1 text-text-subtle hover:text-primary-600 rounded cursor-pointer">
            <Edit2 size={13} />
          </button>
          <button onClick={() => handleDeleteTask(task.id)} className="p-1 text-text-subtle hover:text-red-600 rounded cursor-pointer">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    );
  };

  const statusIcons = { 'pending': Clock, 'in_progress': AlertTriangle, 'completed': CheckCircle2 };
  const statusColors = { 'pending': 'text-text-muted', 'in_progress': 'text-amber-600', 'completed': 'text-emerald-600' };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-text">Tasks</h1>
          <p className="text-text-muted text-sm mt-0.5">{filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => handleOpenModal()} className="btn-primary flex-shrink-0">
          <Plus size={16} /> <span className="hidden sm:inline">New Task</span><span className="sm:hidden">New</span>
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Overdue', value: stats.overdue, color: stats.overdue > 0 ? 'text-red-600' : 'text-text' },
          { label: 'Due Today', value: stats.today, color: stats.today > 0 ? 'text-amber-600' : 'text-text' },
          { label: 'Pending', value: stats.pending, color: 'text-text' },
          { label: 'Done This Week', value: stats.completedThisWeek, color: 'text-text' },
        ].map(item => (
          <div key={item.label} className="card p-3">
            <p className="text-text-muted text-xs">{item.label}</p>
            <p className={`text-xl font-bold mt-0.5 ${item.color}`}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* View Toggle + Filters */}
      <div className="flex gap-2 sm:gap-3 items-center flex-wrap">
        <div className="flex items-center gap-1 border border-border rounded-lg p-0.5">
          {[
            { mode: 'list', icon: List, label: 'List' },
            { mode: 'board', icon: Kanban, label: 'Board' },
            { mode: 'calendar', icon: CalendarDays, label: 'Calendar' },
          ].map(v => (
            <button
              key={v.mode}
              onClick={() => setViewMode(v.mode)}
              className={`p-1.5 px-2 sm:px-2.5 rounded-md text-xs font-medium flex items-center gap-1 sm:gap-1.5 transition-colors cursor-pointer ${
                viewMode === v.mode ? 'bg-primary-50 text-primary-600' : 'text-text-subtle hover:text-text'
              }`}
            >
              <v.icon size={14} /> <span className="hidden sm:inline">{v.label}</span>
            </button>
          ))}
        </div>
        <div className="relative w-full sm:flex-1 sm:min-w-[160px] sm:max-w-xs order-last sm:order-none">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" />
          <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="input-base pl-8 text-sm py-1.5" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-base text-xs py-1.5 !w-auto">
          <option>All</option>
          {STATUSES.map(s => <option key={s} value={s}>{displayLabel(s)}</option>)}
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="input-base text-xs py-1.5 !w-auto">
          <option value="All">All Types</option>
          {TASK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="input-base text-xs py-1.5 !w-auto hidden sm:block">
          <option>All</option>
          {PRIORITIES.map(p => <option key={p} value={p}>{displayLabel(p)}</option>)}
        </select>
        <select value={contactFilter} onChange={(e) => setContactFilter(e.target.value)} className="input-base text-xs py-1.5 !w-auto hidden sm:block">
          <option value="All">All Contacts</option>
          {contacts.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="input-base text-xs py-1.5 !w-auto hidden sm:block">
          <option>Due Date</option>
          <option>Created</option>
          <option>Priority</option>
          <option>Type</option>
        </select>
      </div>

      {/* Quick Add */}
      {viewMode === 'list' && (
        <div className="card p-2">
          <input
            type="text"
            placeholder="Quick add task... (press Enter)"
            value={quickAddText}
            onChange={(e) => setQuickAddText(e.target.value)}
            onKeyDown={handleQuickAdd}
            className="w-full bg-transparent border-none text-sm text-text placeholder-text-subtle focus:outline-none px-2 py-1"
          />
        </div>
      )}

      {/* Content */}
      <DragDropContext onDragEnd={handleDragEnd}>
        {loading ? (
          <div className="card p-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-3">
                <div className="skeleton w-5 h-5 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-4 w-64" />
                  <div className="skeleton h-3 w-40" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredTasks.length === 0 && viewMode !== 'calendar' ? (
          <div className="card p-8 text-center">
            <CheckCircle2 size={32} className="mx-auto text-text-subtle mb-3" />
            <h2 className="text-text font-semibold mb-1">
              {tasks.length === 0 ? 'No tasks yet' : 'No matching tasks'}
            </h2>
            <p className="text-text-muted text-sm mb-4">
              {tasks.length === 0 ? 'Create your first task to start tracking your work.' : 'Try adjusting your filters.'}
            </p>
            {tasks.length === 0 && (
              <button onClick={() => handleOpenModal()} className="btn-primary">
                <Plus size={16} /> Create Task
              </button>
            )}
          </div>
        ) : viewMode === 'list' ? (
          /* List View with Grouping */
          <div className="space-y-4">
            {groupedTasks.map(([group, groupItems]) => (
              <div key={group}>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <h3 className={`text-xs font-semibold uppercase tracking-wider ${
                    group === 'Overdue' ? 'text-red-600' : group === 'Today' ? 'text-amber-600' : 'text-text-subtle'
                  }`}>
                    {group}
                  </h3>
                  <span className="text-xs text-text-subtle">({groupItems.length})</span>
                  <div className="flex-1 h-px bg-border-subtle" />
                </div>
                <div className="card divide-y divide-border-subtle">
                  {groupItems.map(task => <TaskItem key={task.id} task={task} />)}
                </div>
              </div>
            ))}
          </div>
        ) : viewMode === 'board' ? (
          /* Board View */
          <div className="flex flex-col sm:flex-row gap-4 sm:overflow-x-auto pb-4" style={{ minHeight: '50vh' }}>
            {Object.entries(boardColumns).map(([status, columnTasks]) => {
              const StatusIcon = statusIcons[status];
              return (
                <Droppable key={status} droppableId={status}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`sm:flex-shrink-0 w-full sm:w-[300px] lg:w-[320px] flex flex-col rounded-xl border transition-colors ${
                        snapshot.isDraggingOver ? 'border-primary-300 bg-primary-50/50' : 'border-border bg-surface'
                      }`}
                    >
                      <div className="p-3 border-b border-border-subtle">
                        <div className="flex items-center gap-2">
                          <StatusIcon size={15} className={statusColors[status]} />
                          <h3 className="text-sm font-semibold text-text">{displayLabel(status)}</h3>
                          <span className="ml-auto text-xs text-text-subtle bg-surface-card border border-border-subtle rounded-full px-2 py-0.5">
                            {columnTasks.length}
                          </span>
                        </div>
                      </div>
                      <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                        {columnTasks.map((task, index) => {
                          const contactName = findContactName(contacts, task.contact_id);
                          const typeInfo = getTaskTypeInfo(task.type);
                          return (
                            <Draggable key={task.id} draggableId={task.id} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={`card p-3 border-l-3 type-border-${task.type || 'other'} ${snapshot.isDragging ? 'shadow-lg rotate-1' : ''}`}
                                >
                                  <h4 className="text-sm font-medium text-text mb-1.5">{task.title}</h4>
                                  <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                                    <span className={`badge ${getTaskTypeColor(task.type)}`}>{typeInfo.label}</span>
                                    <span className={`badge ${getPriorityColor(task.priority)}`}>{displayLabel(task.priority || 'medium')}</span>
                                    {task.due_date && (
                                      <span className={`text-xs ${getDueDateInfo(task.due_date).color}`}>
                                        {getDueDateInfo(task.due_date).text}
                                      </span>
                                    )}
                                  </div>
                                  {contactName && (
                                    <p className="text-xs text-text-muted flex items-center gap-1">
                                      <User size={10} /> {contactName}
                                    </p>
                                  )}
                                </div>
                              )}
                            </Draggable>
                          );
                        })}
                        {provided.placeholder}
                        <button
                          onClick={() => { setFormData(prev => ({ ...prev, status })); handleOpenModal(); }}
                          className="w-full border border-dashed border-border-hover rounded-lg p-2 text-text-subtle hover:text-primary-600 hover:border-primary-300 transition-colors flex items-center justify-center gap-1.5 text-xs cursor-pointer"
                        >
                          <Plus size={14} /> Add Task
                        </button>
                      </div>
                    </div>
                  )}
                </Droppable>
              );
            })}
          </div>
        ) : (
          /* Calendar View */
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <button onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))} className="btn-ghost p-1.5">
                <ChevronLeft size={18} />
              </button>
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-semibold text-text">{format(calendarMonth, 'MMMM yyyy')}</h3>
                <span className="text-xs text-text-muted">{calendarTaskCount} tasks</span>
                <button
                  onClick={() => { setCalendarMonth(new Date()); setSelectedDate(null); }}
                  className="btn-ghost text-xs py-1 px-2"
                >
                  Today
                </button>
              </div>
              <button onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))} className="btn-ghost p-1.5">
                <ChevronRight size={18} />
              </button>
            </div>
            <div className="grid grid-cols-7">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                <div key={d} className="text-center text-[10px] sm:text-xs font-semibold text-text-subtle py-1.5 sm:py-2 border-b border-border-subtle">
                  <span className="hidden sm:inline">{d}</span>
                  <span className="sm:hidden">{d.charAt(0)}</span>
                </div>
              ))}
              {calendarDays.map(day => {
                const dayTasks = tasksForDate(day);
                const isCurrentMonth = isSameMonth(day, calendarMonth);
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                const isTodayDate = isToday(day);
                const dateStr = format(day, 'yyyy-MM-dd');

                return (
                  <Droppable key={dateStr} droppableId={dateStr}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        onClick={() => setSelectedDate(isSelected ? null : day)}
                        className={`min-h-[48px] sm:min-h-[80px] p-1 sm:p-1.5 border-b border-r border-border-subtle cursor-pointer transition-colors ${
                          !isCurrentMonth ? 'bg-surface opacity-50' : 'hover:bg-surface'
                        } ${isSelected ? 'bg-primary-50' : ''} ${
                          snapshot.isDraggingOver ? 'bg-primary-50 border-primary-300' : ''
                        }`}
                      >
                        <span className={`text-[10px] sm:text-xs font-medium inline-flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-full ${
                          isTodayDate ? 'bg-primary-600 text-white' : 'text-text-muted'
                        }`}>
                          {format(day, 'd')}
                        </span>
                        <div className="mt-0.5 space-y-0.5 hidden sm:block">
                          {dayTasks.slice(0, 3).map((t, idx) => {
                            const typeInfo = getTaskTypeInfo(t.type);
                            return (
                              <Draggable key={t.id} draggableId={t.id} index={idx}>
                                {(dragProvided, dragSnapshot) => (
                                  <div
                                    ref={dragProvided.innerRef}
                                    {...dragProvided.draggableProps}
                                    {...dragProvided.dragHandleProps}
                                    onClick={(e) => e.stopPropagation()}
                                    className={`text-[10px] px-1.5 py-0.5 rounded truncate border-l-2 ${
                                      t.status === 'completed'
                                        ? 'bg-emerald-100 text-emerald-700 line-through border-l-emerald-500'
                                        : isPast(parseISO(t.due_date)) && !isToday(parseISO(t.due_date))
                                        ? 'bg-red-100 text-red-700 border-l-red-500'
                                        : `bg-gray-100 text-gray-700 type-border-${t.type || 'other'}`
                                    } ${dragSnapshot.isDragging ? 'shadow-lg z-50' : ''}`}
                                  >
                                    {t.title}
                                  </div>
                                )}
                              </Draggable>
                            );
                          })}
                          {dayTasks.length > 3 && (
                            <span className="text-[10px] text-text-subtle">+{dayTasks.length - 3} more</span>
                          )}
                        </div>
                        {/* Mobile: show colored dots */}
                        {dayTasks.length > 0 && (
                          <div className="flex gap-0.5 mt-0.5 sm:hidden justify-center">
                            {dayTasks.slice(0, 3).map(t => (
                              <div
                                key={t.id}
                                className={`w-1.5 h-1.5 rounded-full ${
                                  t.status === 'completed' ? 'bg-emerald-500'
                                    : isPast(parseISO(t.due_date)) && !isToday(parseISO(t.due_date)) ? 'bg-red-500'
                                    : 'bg-primary-500'
                                }`}
                              />
                            ))}
                          </div>
                        )}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                );
              })}
            </div>
            {/* Selected Date Tasks */}
            {selectedDate && (
              <div className="border-t border-border p-4">
                <h4 className="text-sm font-semibold text-text mb-3">
                  Tasks for {format(selectedDate, 'EEEE, MMMM d')}
                </h4>
                {tasksForDate(selectedDate).length === 0 ? (
                  <p className="text-text-subtle text-sm">No tasks on this date</p>
                ) : (
                  <div className="space-y-1">
                    {tasksForDate(selectedDate).map(task => <TaskItem key={task.id} task={task} compact />)}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </DragDropContext>

      {/* Modal */}
      {showModal && (
        <Modal title={editingTask ? 'Edit Task' : 'New Task'} onClose={() => { setShowModal(false); setEditingTask(null); }}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Task Title *</label>
              <input type="text" required value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="input-base" placeholder="Enter task title" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Description</label>
              <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows="2" className="input-base resize-none" placeholder="Task details..." />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Type</label>
                <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })} className="input-base">
                  {TASK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Contact</label>
                <select value={formData.contact_id} onChange={(e) => setFormData({ ...formData, contact_id: e.target.value })} className="input-base">
                  <option value="">No contact</option>
                  {contacts.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Deal</label>
              <select value={formData.deal_id} onChange={(e) => setFormData({ ...formData, deal_id: e.target.value })} className="input-base">
                <option value="">No deal</option>
                {deals.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Priority</label>
                <select value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: e.target.value })} className="input-base">
                  {PRIORITIES.map(p => <option key={p} value={p}>{displayLabel(p)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Status</label>
                <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="input-base">
                  {STATUSES.map(s => <option key={s} value={s}>{displayLabel(s)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Due Date</label>
                <input type="date" value={formData.due_date} onChange={(e) => setFormData({ ...formData, due_date: e.target.value })} className="input-base" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center py-2.5 disabled:opacity-50">
                {saving ? 'Saving...' : (editingTask ? 'Update Task' : 'Create Task')}
              </button>
              <button type="button" onClick={() => { setShowModal(false); setEditingTask(null); }} className="btn-secondary flex-1 justify-center py-2.5">
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
