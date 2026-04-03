import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Modal from '../components/Modal';
import { Plus, Edit2, Trash2, Search } from 'lucide-react';
import { format, isToday, isPast, isThisWeek, parseISO } from 'date-fns';

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  const [statusFilter, setStatusFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [sortBy, setSortBy] = useState('Due Date');
  const [searchQuery, setSearchQuery] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    contact_id: '',
    deal_id: '',
    priority: 'Medium',
    due_date: '',
    status: 'Pending',
  });

  useEffect(() => {
    fetchTasks();
    fetchContacts();
    fetchDeals();
  }, []);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('due_date', { ascending: true });

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchContacts = async () => {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, first_name, last_name')
        .order('first_name');

      if (error) throw error;
      setContacts(data || []);
    } catch (error) {
      console.error('Error fetching contacts:', error);
    }
  };

  const fetchDeals = async () => {
    try {
      const { data, error } = await supabase
        .from('deals')
        .select('id, title')
        .order('title');

      if (error) throw error;
      setDeals(data || []);
    } catch (error) {
      console.error('Error fetching deals:', error);
    }
  };

  const getContactName = (contactId) => {
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return null;
    return `${contact.first_name || ''} ${contact.last_name || ''}`.trim();
  };

  const getDealTitle = (dealId) => {
    const deal = deals.find(d => d.id === dealId);
    return deal?.title || null;
  };

  const filteredTasks = tasks
    .filter((task) => {
      if (statusFilter !== 'All' && task.status !== statusFilter) return false;
      if (priorityFilter !== 'All' && task.priority !== priorityFilter) return false;
      if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'Due Date') {
        return new Date(a.due_date || '2099-12-31') - new Date(b.due_date || '2099-12-31');
      } else if (sortBy === 'Created') {
        return new Date(b.created_at) - new Date(a.created_at);
      } else if (sortBy === 'Priority') {
        const priorityOrder = { Urgent: 0, High: 1, Medium: 2, Low: 3 };
        return (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2);
      }
      return 0;
    });

  const stats = {
    overdue: tasks.filter((t) => {
      if (t.status === 'Completed' || t.status === 'Cancelled') return false;
      return t.due_date && isPast(parseISO(t.due_date)) && !isToday(parseISO(t.due_date));
    }).length,
    today: tasks.filter((t) => {
      if (t.status === 'Completed' || t.status === 'Cancelled') return false;
      return t.due_date && isToday(parseISO(t.due_date));
    }).length,
    pending: tasks.filter((t) => t.status === 'Pending').length,
    completedThisWeek: tasks.filter((t) => {
      return t.status === 'Completed' && t.completed_at && isThisWeek(parseISO(t.completed_at));
    }).length,
  };

  const handleOpenModal = (task = null) => {
    if (task) {
      setEditingTask(task);
      setFormData({
        title: task.title,
        description: task.description || '',
        contact_id: task.contact_id || '',
        deal_id: task.deal_id || '',
        priority: task.priority || 'Medium',
        due_date: task.due_date || '',
        status: task.status || 'Pending',
      });
    } else {
      setEditingTask(null);
      setFormData({
        title: '',
        description: '',
        contact_id: '',
        deal_id: '',
        priority: 'Medium',
        due_date: '',
        status: 'Pending',
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingTask(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const taskData = {
        title: formData.title,
        description: formData.description || null,
        contact_id: formData.contact_id || null,
        deal_id: formData.deal_id || null,
        priority: formData.priority,
        due_date: formData.due_date || null,
        status: formData.status,
      };

      if (editingTask) {
        const { error } = await supabase
          .from('tasks')
          .update(taskData)
          .eq('id', editingTask.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('tasks').insert(taskData);
        if (error) throw error;
      }

      fetchTasks();
      handleCloseModal();
    } catch (error) {
      console.error('Error saving task:', error);
      alert('Error saving task. Please try again.');
    }
  };

  const handleToggleCompleted = async (task) => {
    try {
      const newStatus = task.status === 'Completed' ? 'Pending' : 'Completed';
      const completedAt = newStatus === 'Completed' ? new Date().toISOString() : null;

      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus, completed_at: completedAt })
        .eq('id', task.id);

      if (error) throw error;
      fetchTasks();
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;

    try {
      const { error } = await supabase.from('tasks').delete().eq('id', taskId);
      if (error) throw error;
      fetchTasks();
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const getPriorityColor = (priority) => {
    const colors = {
      Low: 'bg-slate-100 text-slate-600',
      Medium: 'bg-blue-100 text-blue-700',
      High: 'bg-orange-100 text-orange-700',
      Urgent: 'bg-red-100 text-red-700',
    };
    return colors[priority] || colors.Medium;
  };

  const getDueDateColor = (dueDate) => {
    if (!dueDate) return 'text-slate-400';
    const date = parseISO(dueDate);
    if (isPast(date) && !isToday(date)) return 'text-red-600';
    if (isToday(date)) return 'text-amber-600';
    return 'text-slate-500';
  };

  const formatDueDate = (dueDate) => {
    if (!dueDate) return 'No date';
    const date = parseISO(dueDate);
    if (isToday(date)) return 'Today';
    if (isPast(date)) return `Overdue: ${format(date, 'MMM d')}`;
    return format(date, 'MMM d');
  };

  const quickStatItems = [
    { label: 'Overdue', value: stats.overdue, color: stats.overdue > 0 ? 'text-red-600' : 'text-slate-900' },
    { label: 'Due Today', value: stats.today, color: stats.today > 0 ? 'text-amber-600' : 'text-slate-900' },
    { label: 'Pending', value: stats.pending, color: 'text-slate-900' },
    { label: 'Completed This Week', value: stats.completedThisWeek, color: 'text-slate-900' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Tasks</h1>
          <p className="text-slate-500 mt-1">
            {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl transition-all duration-200 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 cursor-pointer"
        >
          <Plus size={18} />
          New Task
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {quickStatItems.map((item) => (
          <div key={item.label} className="glass-card p-4">
            <p className="text-slate-500 text-sm">{item.label}</p>
            <p className={`text-2xl font-bold mt-1 ${item.color}`}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="glass-card p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-base w-full pl-9"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-base"
          >
            <option>All</option>
            <option>Pending</option>
            <option>In Progress</option>
            <option>Completed</option>
            <option>Cancelled</option>
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="input-base"
          >
            <option>All</option>
            <option>Low</option>
            <option>Medium</option>
            <option>High</option>
            <option>Urgent</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="input-base"
          >
            <option>Due Date</option>
            <option>Created</option>
            <option>Priority</option>
          </select>
          <button
            onClick={() => {
              setStatusFilter('All');
              setPriorityFilter('All');
              setSortBy('Due Date');
              setSearchQuery('');
            }}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-all duration-200 cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      </div>

      {/* Task List */}
      {loading ? (
        <div className="glass-card p-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-4">
              <div className="skeleton w-5 h-5 rounded" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-4 w-64" />
                <div className="skeleton h-3 w-40" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <p className="text-slate-500">
            {tasks.length === 0 ? 'No tasks yet. Create your first task to get started.' : 'No tasks match your filters.'}
          </p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          {filteredTasks.map((task, index) => {
            const contactName = getContactName(task.contact_id);
            const dealTitle = getDealTitle(task.deal_id);

            return (
              <div
                key={task.id}
                className={`p-4 hover:bg-indigo-50/30 transition-colors ${
                  task.status === 'Completed' ? 'opacity-60' : ''
                } ${index < filteredTasks.length - 1 ? 'border-b border-slate-100' : ''}`}
              >
                <div className="flex items-start gap-4">
                  {/* Checkbox */}
                  <div className="pt-0.5">
                    <button
                      onClick={() => handleToggleCompleted(task)}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors cursor-pointer ${
                        task.status === 'Completed'
                          ? 'bg-indigo-600 border-indigo-600'
                          : 'border-slate-300 hover:border-indigo-500'
                      }`}
                    >
                      {task.status === 'Completed' && (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                  </div>

                  {/* Task Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-1.5">
                      <h3 className={`font-medium text-slate-800 ${task.status === 'Completed' ? 'line-through text-slate-400' : ''}`}>
                        {task.title}
                      </h3>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${getPriorityColor(task.priority)}`}>
                        {task.priority || 'Medium'}
                      </span>
                    </div>

                    {task.description && (
                      <p className="text-sm text-slate-400 mb-2 truncate">{task.description}</p>
                    )}

                    <div className="flex items-center gap-4 text-sm flex-wrap">
                      <span className={getDueDateColor(task.due_date)}>
                        {formatDueDate(task.due_date)}
                      </span>
                      {contactName && (
                        <span className="text-slate-500">{contactName}</span>
                      )}
                      {dealTitle && (
                        <span className="text-slate-500">{dealTitle}</span>
                      )}
                      <span className="text-slate-400 text-xs">{task.status}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleOpenModal(task)}
                      className="p-1.5 text-slate-300 hover:text-indigo-600 transition-colors rounded-lg hover:bg-indigo-50 cursor-pointer"
                      title="Edit"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      onClick={() => handleDeleteTask(task.id)}
                      className="p-1.5 text-slate-300 hover:text-red-600 transition-colors rounded-lg hover:bg-red-50 cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <Modal title={editingTask ? 'Edit Task' : 'New Task'} onClose={handleCloseModal}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Task Title *</label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="input-base w-full"
                placeholder="Enter task title"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows="2"
                className="input-base w-full resize-none"
                placeholder="Task details..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Contact</label>
              <select
                value={formData.contact_id}
                onChange={(e) => setFormData({ ...formData, contact_id: e.target.value })}
                className="input-base w-full"
              >
                <option value="">No contact</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.first_name} {c.last_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Deal</label>
              <select
                value={formData.deal_id}
                onChange={(e) => setFormData({ ...formData, deal_id: e.target.value })}
                className="input-base w-full"
              >
                <option value="">No deal</option>
                {deals.map((d) => (
                  <option key={d.id} value={d.id}>{d.title}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Priority</label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  className="input-base w-full"
                >
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                  <option>Urgent</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="input-base w-full"
                >
                  <option>Pending</option>
                  <option>In Progress</option>
                  <option>Completed</option>
                  <option>Cancelled</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Due Date</label>
                <input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  className="input-base w-full"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-xl transition-all duration-200 cursor-pointer shadow-lg shadow-indigo-500/25"
              >
                {editingTask ? 'Update Task' : 'Create Task'}
              </button>
              <button
                type="button"
                onClick={handleCloseModal}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2.5 rounded-xl transition-all duration-200 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
