import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';
import {
  getColorFromHash, getInitials, getStatusBadgeColor, getPriorityColor,
  formatRelativeDate, formatCurrency, getDueDateInfo, getContactFullName,
  getTaskTypeInfo, getTaskTypeColor, TASK_TYPES,
} from '../lib/utils';
import {
  ArrowLeft, Edit, Phone, Mail, Building, Calendar,
  MessageSquare, CheckSquare, TrendingUp, Plus, AlertCircle,
  ArrowUpRight, ArrowDownLeft, Trash2, FileText, Clock,
  PhoneCall, StickyNote, User,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

export default function ContactDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [contact, setContact] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Timeline');
  const [notes, setNotes] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [interactions, setInteractions] = useState([]);
  const [deals, setDeals] = useState([]);
  const [stages, setStages] = useState([]);

  const [newNote, setNewNote] = useState('');
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showInteractionForm, setShowInteractionForm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', status: 'Pending', priority: 'Medium', dueDate: '', type: 'other' });
  const [newInteraction, setNewInteraction] = useState({ subject: '', content: '', channel: 'email', direction: 'outbound' });
  const [editForm, setEditForm] = useState({
    first_name: '', last_name: '', email: '', phone: '', company: '', source: 'manual', status: 'lead', tags: '',
  });

  useEffect(() => { fetchContactData(); }, [id]);

  const fetchContactData = async () => {
    try {
      setLoading(true);
      const { data: contactData, error } = await supabase.from('contacts').select('*').eq('id', id).single();
      if (error) throw error;
      setContact(contactData);

      const [notesData, tasksData, interactionsData, dealsData, stagesData] = await Promise.all([
        supabase.from('notes').select('*').eq('contact_id', id).order('created_at', { ascending: false }),
        supabase.from('tasks').select('*').eq('contact_id', id).order('created_at', { ascending: false }),
        supabase.from('interactions').select('*').eq('contact_id', id).order('created_at', { ascending: false }),
        supabase.from('deals').select('*').eq('contact_id', id).order('created_at', { ascending: false }),
        supabase.from('pipeline_stages').select('id, name').order('position', { ascending: true }),
      ]);
      setNotes(notesData.data || []);
      setTasks(tasksData.data || []);
      setInteractions(interactionsData.data || []);
      setDeals(dealsData.data || []);
      setStages(stagesData.data || []);
    } catch (error) {
      console.error('Error fetching contact data:', error);
      toast.error('Failed to load contact');
    } finally {
      setLoading(false);
    }
  };

  // Unified timeline
  const timeline = useMemo(() => {
    return [
      ...notes.map(n => ({ ...n, _type: 'note', _icon: FileText, _color: 'bg-blue-50 text-blue-600' })),
      ...interactions.map(i => ({ ...i, _type: 'interaction', _icon: i.direction === 'inbound' ? ArrowDownLeft : ArrowUpRight, _color: i.direction === 'inbound' ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600' })),
      ...tasks.map(t => ({ ...t, _type: 'task', _icon: CheckSquare, _color: t.status === 'Completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600' })),
      ...deals.map(d => ({ ...d, _type: 'deal', _icon: TrendingUp, _color: 'bg-violet-50 text-violet-600' })),
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [notes, interactions, tasks, deals]);

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('notes').insert([{ contact_id: id, content: newNote, source: 'manual' }]);
      if (error) throw error;
      setNewNote(''); setShowNoteForm(false);
      toast.success('Note added');
      fetchContactData();
    } catch (error) {
      console.error('Error adding note:', error);
      toast.error(error.message || 'Failed to add note');
    } finally {
      setSaving(false);
    }
  };

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTask.title.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('tasks').insert([{
        contact_id: id, title: newTask.title, status: newTask.status,
        priority: newTask.priority, due_date: newTask.dueDate || null,
        type: newTask.type || 'other',
      }]);
      if (error) throw error;
      setNewTask({ title: '', status: 'Pending', priority: 'Medium', dueDate: '', type: 'other' });
      setShowTaskForm(false);
      toast.success('Task created');
      fetchContactData();
    } catch (error) {
      console.error('Error adding task:', error);
      toast.error(error.message || 'Failed to create task');
    } finally {
      setSaving(false);
    }
  };

  const handleAddInteraction = async (e) => {
    e.preventDefault();
    if (!newInteraction.subject.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('interactions').insert([{
        contact_id: id, subject: newInteraction.subject,
        content: newInteraction.content || null, channel: newInteraction.channel,
        direction: newInteraction.direction,
      }]);
      if (error) throw error;
      setNewInteraction({ subject: '', content: '', channel: 'email', direction: 'outbound' });
      setShowInteractionForm(false);
      toast.success('Interaction logged');
      fetchContactData();
    } catch (error) {
      console.error('Error adding interaction:', error);
      toast.error(error.message || 'Failed to log interaction');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenEdit = () => {
    setEditForm({
      first_name: contact.first_name || '', last_name: contact.last_name || '',
      email: contact.email || '', phone: contact.phone || '', company: contact.company || '',
      source: contact.source || 'manual', status: contact.status || 'lead',
      tags: (contact.tags || []).join(', '),
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await supabase.from('contacts').update({
        first_name: editForm.first_name, last_name: editForm.last_name,
        email: editForm.email || null, phone: editForm.phone || null,
        company: editForm.company || null, source: editForm.source, status: editForm.status,
        tags: editForm.tags.split(',').map(t => t.trim()).filter(t => t),
      }).eq('id', id);
      if (error) throw error;
      setShowEditModal(false);
      toast.success('Contact updated');
      fetchContactData();
    } catch (error) {
      console.error('Error updating contact:', error);
      toast.error(error.message || 'Failed to update contact');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteContact = async () => {
    if (!window.confirm('Delete this contact and all associated data?')) return;
    try {
      await Promise.all([
        supabase.from('notes').delete().eq('contact_id', id),
        supabase.from('tasks').delete().eq('contact_id', id),
        supabase.from('interactions').delete().eq('contact_id', id),
      ]);
      const { error } = await supabase.from('contacts').delete().eq('id', id);
      if (error) throw error;
      toast.success('Contact deleted');
      navigate('/contacts');
    } catch (error) {
      console.error('Error deleting contact:', error);
      toast.error('Failed to delete contact');
    }
  };

  const handleToggleTask = async (task) => {
    const newStatus = task.status === 'Completed' ? 'Pending' : 'Completed';
    const completedAt = newStatus === 'Completed' ? new Date().toISOString() : null;
    // Optimistic
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus, completed_at: completedAt } : t));
    try {
      const { error } = await supabase.from('tasks').update({ status: newStatus, completed_at: completedAt }).eq('id', task.id);
      if (error) throw error;
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('Failed to update task');
      fetchContactData();
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-5 w-32" />
        <div className="card p-6">
          <div className="flex items-start gap-5">
            <div className="skeleton w-14 h-14 rounded-xl" />
            <div className="space-y-2 flex-1">
              <div className="skeleton h-6 w-48" />
              <div className="skeleton h-4 w-32" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate('/contacts')} className="flex items-center gap-1.5 text-primary-600 text-sm font-medium cursor-pointer">
          <ArrowLeft size={16} /> Back to Contacts
        </button>
        <div className="card p-8 text-center">
          <AlertCircle size={28} className="mx-auto text-text-subtle mb-2" />
          <p className="text-text-muted">Contact not found</p>
        </div>
      </div>
    );
  }

  const totalDealValue = deals.reduce((sum, d) => sum + (d.value || 0), 0);
  const tabs = ['Timeline', 'Notes', 'Tasks', 'Interactions', 'Deals'];

  return (
    <div className="space-y-4">
      <button onClick={() => navigate('/contacts')} className="flex items-center gap-1.5 text-primary-600 hover:text-primary-700 text-sm font-medium cursor-pointer">
        <ArrowLeft size={16} /> Back to Contacts
      </button>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Sidebar - Contact Info */}
        <div className="space-y-4">
          <div className="card p-5">
            <div className="flex items-start justify-between mb-4">
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                style={{ backgroundColor: getColorFromHash(`${contact.first_name}${contact.last_name}`) }}
              >
                {getInitials(contact.first_name, contact.last_name)}
              </div>
              <div className="flex gap-1.5">
                <button onClick={handleOpenEdit} className="btn-secondary text-xs py-1.5 px-2.5">
                  <Edit size={13} />
                </button>
                <button onClick={handleDeleteContact} className="btn-danger text-xs py-1.5 px-2.5">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
            <h1 className="text-lg font-bold text-text">{contact.first_name} {contact.last_name}</h1>
            {contact.company && (
              <p className="text-text-muted text-sm flex items-center gap-1.5 mt-1">
                <Building size={13} /> {contact.company}
              </p>
            )}
            <div className="flex flex-wrap gap-1.5 mt-3">
              <span className={`badge ${getStatusBadgeColor(contact.status)}`}>
                {contact.status ? contact.status.charAt(0).toUpperCase() + contact.status.slice(1) : 'Unknown'}
              </span>
              {contact.source && (
                <span className="badge badge-inactive capitalize">{contact.source}</span>
              )}
              {contact.tags?.map((tag, i) => (
                <span key={i} className="badge bg-primary-50 text-primary-700">{tag}</span>
              ))}
            </div>

            <div className="border-t border-border-subtle mt-4 pt-4 space-y-3 text-sm">
              {contact.email && (
                <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-primary-600 hover:text-primary-700">
                  <Mail size={14} /> <span className="truncate">{contact.email}</span>
                </a>
              )}
              {contact.phone && (
                <a href={`tel:${contact.phone}`} className="flex items-center gap-2 text-primary-600 hover:text-primary-700">
                  <Phone size={14} /> {contact.phone}
                </a>
              )}
              <div className="flex items-center gap-2 text-text-muted">
                <Calendar size={14} /> Added {format(new Date(contact.created_at), 'MMM d, yyyy')}
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="card p-3 text-center">
              <p className="text-text-muted text-xs">Deals</p>
              <p className="text-xl font-bold text-text">{deals.length}</p>
              {totalDealValue > 0 && <p className="text-text-subtle text-xs">{formatCurrency(totalDealValue)}</p>}
            </div>
            <div className="card p-3 text-center">
              <p className="text-text-muted text-xs">Tasks</p>
              <p className="text-xl font-bold text-text">{tasks.length}</p>
              <p className="text-text-subtle text-xs">{tasks.filter(t => t.status !== 'Completed').length} pending</p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card p-3 space-y-1">
            <button onClick={() => { setActiveTab('Notes'); setShowNoteForm(true); }} className="w-full flex items-center gap-2 p-2 rounded-md text-sm text-text-muted hover:bg-surface hover:text-text transition-colors cursor-pointer text-left">
              <StickyNote size={14} /> Add Note
            </button>
            <button onClick={() => { setActiveTab('Tasks'); setShowTaskForm(true); }} className="w-full flex items-center gap-2 p-2 rounded-md text-sm text-text-muted hover:bg-surface hover:text-text transition-colors cursor-pointer text-left">
              <CheckSquare size={14} /> Create Task
            </button>
            <button onClick={() => { setActiveTab('Interactions'); setShowInteractionForm(true); }} className="w-full flex items-center gap-2 p-2 rounded-md text-sm text-text-muted hover:bg-surface hover:text-text transition-colors cursor-pointer text-left">
              <PhoneCall size={14} /> Log Interaction
            </button>
          </div>
        </div>

        {/* Right Content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tabs */}
          <div className="border-b border-border overflow-x-auto">
            <div className="flex gap-0 -mb-px min-w-max">
              {tabs.map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                    activeTab === tab
                      ? 'border-primary-600 text-primary-600'
                      : 'border-transparent text-text-muted hover:text-text hover:border-border-hover'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          {/* Timeline */}
          {activeTab === 'Timeline' && (
            <div className="space-y-2">
              {timeline.length === 0 ? (
                <div className="card p-8 text-center">
                  <Clock size={24} className="mx-auto text-text-subtle mb-2" />
                  <p className="text-text-muted text-sm">No activity yet</p>
                </div>
              ) : (
                timeline.map(item => {
                  const Icon = item._icon;
                  return (
                    <div key={`${item._type}-${item.id}`} className="flex gap-3 p-3 card">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${item._color}`}>
                        <Icon size={15} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-text text-sm">
                          {item._type === 'note' && (item.content?.substring(0, 100) || 'Note')}
                          {item._type === 'interaction' && (item.subject || 'Interaction')}
                          {item._type === 'task' && item.title}
                          {item._type === 'deal' && item.title}
                        </p>
                        {item._type === 'interaction' && item.content && (
                          <p className="text-text-subtle text-xs mt-0.5 line-clamp-1">{item.content}</p>
                        )}
                        {item._type === 'deal' && item.value > 0 && (
                          <p className="text-text-muted text-xs mt-0.5">{formatCurrency(item.value)} · {item.stage}</p>
                        )}
                        {item._type === 'task' && (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`badge ${getTaskTypeColor(item.type)}`}>{getTaskTypeInfo(item.type).label}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-1 text-xs text-text-subtle">
                          <span className="capitalize">{item._type}</span>
                          <span>{formatRelativeDate(item.created_at)}</span>
                          {item._type === 'interaction' && item.channel && <span className="capitalize">{item.channel}</span>}
                          {item._type === 'task' && <span className={`badge ${getPriorityColor(item.priority)}`}>{item.priority}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Notes Tab */}
          {activeTab === 'Notes' && (
            <div className="space-y-3">
              <button onClick={() => setShowNoteForm(!showNoteForm)} className="btn-primary text-xs">
                <Plus size={14} /> Add Note
              </button>
              {showNoteForm && (
                <form onSubmit={handleAddNote} className="card p-4">
                  <textarea value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Write a note..." className="input-base resize-none h-20 mb-3" />
                  <div className="flex gap-2">
                    <button type="submit" disabled={saving} className="btn-primary text-xs disabled:opacity-50">{saving ? 'Saving...' : 'Save Note'}</button>
                    <button type="button" onClick={() => { setShowNoteForm(false); setNewNote(''); }} className="btn-secondary text-xs">Cancel</button>
                  </div>
                </form>
              )}
              {notes.length === 0 ? (
                <div className="text-center py-8 text-text-subtle text-sm">No notes yet</div>
              ) : (
                notes.map(note => (
                  <div key={note.id} className="card p-4">
                    <p className="text-text text-sm whitespace-pre-wrap">{note.content}</p>
                    <div className="flex gap-3 mt-2 text-xs text-text-subtle">
                      <span>{formatRelativeDate(note.created_at)}</span>
                      {note.source && <span className="capitalize">{note.source}</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tasks Tab */}
          {activeTab === 'Tasks' && (
            <div className="space-y-3">
              <button onClick={() => setShowTaskForm(!showTaskForm)} className="btn-primary text-xs">
                <Plus size={14} /> Add Task
              </button>
              {showTaskForm && (
                <form onSubmit={handleAddTask} className="card p-4 space-y-3">
                  <input type="text" value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} placeholder="Task title..." className="input-base" />
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <select value={newTask.type} onChange={(e) => setNewTask({ ...newTask, type: e.target.value })} className="input-base text-sm">
                      {TASK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <select value={newTask.priority} onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })} className="input-base text-sm">
                      <option>Low</option><option>Medium</option><option>High</option><option>Urgent</option>
                    </select>
                    <select value={newTask.status} onChange={(e) => setNewTask({ ...newTask, status: e.target.value })} className="input-base text-sm">
                      <option>Pending</option><option>In Progress</option><option>Completed</option>
                    </select>
                    <input type="date" value={newTask.dueDate} onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })} className="input-base text-sm" />
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" disabled={saving} className="btn-primary text-xs disabled:opacity-50">{saving ? 'Saving...' : 'Save Task'}</button>
                    <button type="button" onClick={() => setShowTaskForm(false)} className="btn-secondary text-xs">Cancel</button>
                  </div>
                </form>
              )}
              {tasks.length === 0 ? (
                <div className="text-center py-8 text-text-subtle text-sm">No tasks yet</div>
              ) : (
                tasks.map(task => {
                  const typeInfo = getTaskTypeInfo(task.type);
                  return (
                    <div key={task.id} className={`card p-3 flex items-start gap-3 border-l-3 type-border-${task.type || 'other'}`}>
                      <button
                        onClick={() => handleToggleTask(task)}
                        className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 cursor-pointer ${
                          task.status === 'Completed' ? 'bg-primary-600 border-primary-600' : 'border-border-hover hover:border-primary-400'
                        }`}
                      >
                        {task.status === 'Completed' && (
                          <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        )}
                      </button>
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${task.status === 'Completed' ? 'line-through text-text-subtle' : 'text-text'}`}>{task.title}</p>
                        <div className="flex gap-1.5 mt-1 text-xs flex-wrap">
                          <span className={`badge ${getTaskTypeColor(task.type)}`}>{typeInfo.label}</span>
                          <span className={`badge ${getPriorityColor(task.priority)}`}>{task.priority || 'Medium'}</span>
                          {task.due_date && <span className={getDueDateInfo(task.due_date).color}>{getDueDateInfo(task.due_date).text}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Interactions Tab */}
          {activeTab === 'Interactions' && (
            <div className="space-y-3">
              <button onClick={() => setShowInteractionForm(!showInteractionForm)} className="btn-primary text-xs">
                <Plus size={14} /> Log Interaction
              </button>
              {showInteractionForm && (
                <form onSubmit={handleAddInteraction} className="card p-4 space-y-3">
                  <input type="text" value={newInteraction.subject} onChange={(e) => setNewInteraction({ ...newInteraction, subject: e.target.value })} placeholder="Subject..." className="input-base" />
                  <textarea value={newInteraction.content} onChange={(e) => setNewInteraction({ ...newInteraction, content: e.target.value })} placeholder="Details..." rows="2" className="input-base resize-none" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <select value={newInteraction.channel} onChange={(e) => setNewInteraction({ ...newInteraction, channel: e.target.value })} className="input-base text-sm">
                      <option value="email">Email</option><option value="whatsapp">WhatsApp</option><option value="instagram">Instagram</option>
                      <option value="linkedin">LinkedIn</option><option value="phone">Phone Call</option><option value="meeting">Meeting</option><option value="other">Other</option>
                    </select>
                    <select value={newInteraction.direction} onChange={(e) => setNewInteraction({ ...newInteraction, direction: e.target.value })} className="input-base text-sm">
                      <option value="outbound">Outbound</option><option value="inbound">Inbound</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" disabled={saving} className="btn-primary text-xs disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
                    <button type="button" onClick={() => setShowInteractionForm(false)} className="btn-secondary text-xs">Cancel</button>
                  </div>
                </form>
              )}
              {interactions.length === 0 ? (
                <div className="text-center py-8 text-text-subtle text-sm">No interactions logged</div>
              ) : (
                interactions.map(interaction => (
                  <div key={interaction.id} className="card p-3 flex gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      interaction.direction === 'inbound' ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'
                    }`}>
                      {interaction.direction === 'inbound' ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-text text-sm font-medium">{interaction.subject || 'Interaction'}</p>
                      {interaction.content && <p className="text-text-muted text-xs mt-0.5 line-clamp-2">{interaction.content}</p>}
                      <div className="flex items-center gap-2 mt-1.5 text-xs text-text-subtle">
                        {interaction.channel && <span className="capitalize">{interaction.channel}</span>}
                        <span>{formatRelativeDate(interaction.created_at)}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Deals Tab */}
          {activeTab === 'Deals' && (
            <div className="space-y-3">
              {deals.length === 0 ? (
                <div className="text-center py-8 text-text-subtle text-sm">No deals associated</div>
              ) : (
                deals.map(deal => (
                  <div key={deal.id} className="card p-4 cursor-pointer hover:border-border-hover transition-colors" onClick={() => navigate('/pipeline')}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-text font-medium">{deal.title}</p>
                        {deal.description && <p className="text-text-muted text-sm mt-0.5">{deal.description}</p>}
                      </div>
                      <div className="text-right">
                        {deal.value > 0 && <p className="text-text font-semibold">{formatCurrency(deal.value)}</p>}
                      </div>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <span className="badge bg-primary-50 text-primary-700">{stages.find(s => s.id === deal.stage_id)?.name || 'Unknown'}</span>
                      {deal.status && deal.status !== 'active' && deal.status !== 'open' && (
                        <span className={`badge ${deal.status === 'won' ? 'badge-won' : deal.status === 'lost' ? 'badge-lost' : 'badge-inactive'}`}>
                          {deal.status.charAt(0).toUpperCase() + deal.status.slice(1)}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <Modal title="Edit Contact" onClose={() => setShowEditModal(false)}>
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">First Name *</label>
                <input type="text" required value={editForm.first_name} onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })} className="input-base" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Last Name *</label>
                <input type="text" required value={editForm.last_name} onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })} className="input-base" />
              </div>
            </div>
            <div><label className="block text-xs font-medium text-text-secondary mb-1.5">Email</label><input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="input-base" /></div>
            <div><label className="block text-xs font-medium text-text-secondary mb-1.5">Phone</label><input type="tel" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="input-base" /></div>
            <div><label className="block text-xs font-medium text-text-secondary mb-1.5">Company</label><input type="text" value={editForm.company} onChange={(e) => setEditForm({ ...editForm, company: e.target.value })} className="input-base" /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Source</label>
                <select value={editForm.source} onChange={(e) => setEditForm({ ...editForm, source: e.target.value })} className="input-base">
                  <option value="manual">Manual</option><option value="instagram">Instagram</option><option value="whatsapp">WhatsApp</option>
                  <option value="gmail">Gmail</option><option value="outlook">Outlook</option><option value="linkedin">LinkedIn</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Status</label>
                <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} className="input-base">
                  <option value="lead">Lead</option><option value="active">Active</option><option value="client">Client</option><option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Tags</label>
              <input type="text" value={editForm.tags} onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })} placeholder="Comma-separated" className="input-base" />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center py-2.5 disabled:opacity-50">{saving ? 'Saving...' : 'Save Changes'}</button>
              <button type="button" onClick={() => setShowEditModal(false)} className="btn-secondary flex-1 justify-center py-2.5">Cancel</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
