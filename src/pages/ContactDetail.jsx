import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Modal from '../components/Modal';
import {
  ArrowLeft, Edit, Phone, Mail, Building, Calendar,
  MessageSquare, CheckSquare, TrendingUp, Plus, AlertCircle,
  ArrowUpRight, ArrowDownLeft, Trash2
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

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

export default function ContactDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [contact, setContact] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Overview');
  const [notes, setNotes] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [interactions, setInteractions] = useState([]);
  const [deals, setDeals] = useState([]);

  const [newNote, setNewNote] = useState('');
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showInteractionForm, setShowInteractionForm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', status: 'Pending', priority: 'Medium', dueDate: '' });
  const [newInteraction, setNewInteraction] = useState({
    subject: '', content: '', channel: 'email', direction: 'outbound'
  });
  const [editForm, setEditForm] = useState({
    first_name: '', last_name: '', email: '', phone: '', company: '', source: 'manual', status: 'lead', tags: ''
  });

  useEffect(() => {
    fetchContactData();
  }, [id]);

  const fetchContactData = async () => {
    try {
      setLoading(true);
      const { data: contactData, error: contactError } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', id)
        .single();

      if (contactError) throw contactError;
      setContact(contactData);

      const [notesData, tasksData, interactionsData, dealsData] = await Promise.all([
        supabase.from('notes').select('*').eq('contact_id', id).order('created_at', { ascending: false }),
        supabase.from('tasks').select('*').eq('contact_id', id).order('created_at', { ascending: false }),
        supabase.from('interactions').select('*').eq('contact_id', id).order('created_at', { ascending: false }),
        supabase.from('deals').select('*').eq('contact_id', id).order('created_at', { ascending: false }),
      ]);

      setNotes(notesData.data || []);
      setTasks(tasksData.data || []);
      setInteractions(interactionsData.data || []);
      setDeals(dealsData.data || []);
    } catch (error) {
      console.error('Error fetching contact data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    try {
      const { error } = await supabase.from('notes').insert([{ contact_id: id, content: newNote, source: 'manual' }]);
      if (error) throw error;
      setNewNote('');
      setShowNoteForm(false);
      fetchContactData();
    } catch (error) {
      console.error('Error adding note:', error);
    }
  };

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTask.title.trim()) return;
    try {
      const { error } = await supabase.from('tasks').insert([{
        contact_id: id,
        title: newTask.title,
        status: newTask.status,
        priority: newTask.priority,
        due_date: newTask.dueDate || null,
      }]);
      if (error) throw error;
      setNewTask({ title: '', status: 'Pending', priority: 'Medium', dueDate: '' });
      setShowTaskForm(false);
      fetchContactData();
    } catch (error) {
      console.error('Error adding task:', error);
    }
  };

  const handleAddInteraction = async (e) => {
    e.preventDefault();
    if (!newInteraction.subject.trim()) return;
    try {
      const { error } = await supabase.from('interactions').insert([{
        contact_id: id,
        subject: newInteraction.subject,
        content: newInteraction.content || null,
        channel: newInteraction.channel,
        direction: newInteraction.direction,
      }]);
      if (error) throw error;
      setNewInteraction({ subject: '', content: '', channel: 'email', direction: 'outbound' });
      setShowInteractionForm(false);
      fetchContactData();
    } catch (error) {
      console.error('Error adding interaction:', error);
    }
  };

  const handleOpenEdit = () => {
    setEditForm({
      first_name: contact.first_name || '',
      last_name: contact.last_name || '',
      email: contact.email || '',
      phone: contact.phone || '',
      company: contact.company || '',
      source: contact.source || 'manual',
      status: contact.status || 'lead',
      tags: (contact.tags || []).join(', '),
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('contacts')
        .update({
          first_name: editForm.first_name,
          last_name: editForm.last_name,
          email: editForm.email || null,
          phone: editForm.phone || null,
          company: editForm.company || null,
          source: editForm.source,
          status: editForm.status,
          tags: editForm.tags.split(',').map(t => t.trim()).filter(t => t),
        })
        .eq('id', id);

      if (error) throw error;
      setShowEditModal(false);
      fetchContactData();
    } catch (error) {
      console.error('Error updating contact:', error);
      alert('Error updating contact');
    }
  };

  const handleDeleteContact = async () => {
    if (!window.confirm('Are you sure you want to delete this contact? This will also remove associated notes, tasks, and interactions.')) return;
    try {
      await Promise.all([
        supabase.from('notes').delete().eq('contact_id', id),
        supabase.from('tasks').delete().eq('contact_id', id),
        supabase.from('interactions').delete().eq('contact_id', id),
      ]);
      const { error } = await supabase.from('contacts').delete().eq('id', id);
      if (error) throw error;
      navigate('/contacts');
    } catch (error) {
      console.error('Error deleting contact:', error);
      alert('Error deleting contact');
    }
  };

  const handleToggleTask = async (task) => {
    const newStatus = task.status === 'Completed' ? 'Pending' : 'Completed';
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus, completed_at: newStatus === 'Completed' ? new Date().toISOString() : null })
        .eq('id', task.id);
      if (error) throw error;
      fetchContactData();
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const getStatusBadgeColor = (status) => {
    const colors = {
      lead: 'bg-blue-100 text-blue-700',
      active: 'bg-emerald-100 text-emerald-700',
      client: 'bg-violet-100 text-violet-700',
      inactive: 'bg-slate-100 text-slate-600',
    };
    return colors[status?.toLowerCase()] || 'bg-slate-100 text-slate-600';
  };

  const getPriorityColor = (priority) => {
    const p = (priority || '').toLowerCase();
    if (p === 'urgent' || p === 'high') return 'bg-red-100 text-red-700';
    if (p === 'medium') return 'bg-blue-100 text-blue-700';
    return 'bg-slate-100 text-slate-600';
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-5 w-32" />
        <div className="glass-card p-6">
          <div className="flex items-start gap-5">
            <div className="skeleton w-16 h-16 rounded-full" />
            <div className="space-y-3 flex-1">
              <div className="skeleton h-7 w-48" />
              <div className="skeleton h-4 w-32" />
              <div className="skeleton h-4 w-64" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate('/contacts')} className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 cursor-pointer">
          <ArrowLeft size={20} /> Back to Contacts
        </button>
        <div className="text-center py-12">
          <AlertCircle size={32} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500">Contact not found</p>
        </div>
      </div>
    );
  }

  const totalDealValue = deals.reduce((sum, d) => sum + (d.value || 0), 0);

  const btnPrimary = "flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl transition-all duration-200 text-sm shadow-md shadow-indigo-500/20 cursor-pointer";
  const btnSecondary = "bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl transition-all duration-200 text-sm cursor-pointer";

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button onClick={() => navigate('/contacts')} className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 transition-colors text-sm font-medium cursor-pointer">
        <ArrowLeft size={18} /> Back to Contacts
      </button>

      {/* Contact Header */}
      <div className="glass-card p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-start gap-5">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0 shadow-lg"
              style={{ backgroundColor: getColorFromHash(`${contact.first_name}${contact.last_name}`) }}
            >
              {getInitials(contact.first_name, contact.last_name)}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                {contact.first_name} {contact.last_name}
              </h1>
              {contact.company && (
                <p className="text-slate-500 mt-1 flex items-center gap-2 text-sm">
                  <Building size={14} /> {contact.company}
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-3">
                {contact.email && (
                  <a href={`mailto:${contact.email}`} className="text-indigo-600 hover:text-indigo-700 flex items-center gap-1.5 text-sm">
                    <Mail size={14} /> {contact.email}
                  </a>
                )}
                {contact.phone && (
                  <a href={`tel:${contact.phone}`} className="text-indigo-600 hover:text-indigo-700 flex items-center gap-1.5 text-sm">
                    <Phone size={14} /> {contact.phone}
                  </a>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(contact.status)}`}>
                  {contact.status ? contact.status.charAt(0).toUpperCase() + contact.status.slice(1) : 'Unknown'}
                </span>
                {contact.source && (
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 capitalize">
                    {contact.source}
                  </span>
                )}
                {contact.tags?.length > 0 && contact.tags.map((tag, i) => (
                  <span key={i} className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleOpenEdit} className={btnPrimary}>
              <Edit size={15} /> Edit
            </button>
            <button
              onClick={handleDeleteContact}
              className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 px-3 py-2 rounded-xl transition-all duration-200 text-sm cursor-pointer"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Tab Navigation — Pill Style */}
      <div className="flex gap-2 flex-wrap">
        {['Overview', 'Notes', 'Tasks', 'Interactions', 'Deals'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 cursor-pointer ${
              activeTab === tab
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25'
                : 'bg-white/60 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {/* Overview */}
        {activeTab === 'Overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Contact Info</h3>
              <div className="space-y-4 text-sm">
                {contact.email && (
                  <div>
                    <p className="text-slate-400 mb-0.5">Email</p>
                    <a href={`mailto:${contact.email}`} className="text-indigo-600 hover:underline">{contact.email}</a>
                  </div>
                )}
                {contact.phone && (
                  <div>
                    <p className="text-slate-400 mb-0.5">Phone</p>
                    <a href={`tel:${contact.phone}`} className="text-indigo-600 hover:underline">{contact.phone}</a>
                  </div>
                )}
                {contact.company && (
                  <div>
                    <p className="text-slate-400 mb-0.5">Company</p>
                    <p className="text-slate-800">{contact.company}</p>
                  </div>
                )}
                <div>
                  <p className="text-slate-400 mb-0.5">Added</p>
                  <p className="text-slate-800">{format(new Date(contact.created_at), 'MMM d, yyyy')}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="glass-card p-5">
                <div className="flex items-center gap-3">
                  <div className="bg-emerald-100 p-2.5 rounded-xl">
                    <TrendingUp size={20} className="text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Deals</p>
                    <p className="text-xl font-bold text-slate-900">{deals.length}</p>
                    {totalDealValue > 0 && <p className="text-slate-500 text-xs">{'\u00A3'}{totalDealValue.toLocaleString()} total</p>}
                  </div>
                </div>
              </div>
              <div className="glass-card p-5">
                <div className="flex items-center gap-3">
                  <div className="bg-amber-100 p-2.5 rounded-xl">
                    <CheckSquare size={20} className="text-amber-600" />
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Tasks</p>
                    <p className="text-xl font-bold text-slate-900">{tasks.length}</p>
                    <p className="text-slate-500 text-xs">{tasks.filter(t => t.status !== 'Completed').length} pending</p>
                  </div>
                </div>
              </div>
              <div className="glass-card p-5">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 p-2.5 rounded-xl">
                    <MessageSquare size={20} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Interactions</p>
                    <p className="text-xl font-bold text-slate-900">{interactions.length}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Recent Activity</h3>
              {interactions.length === 0 && notes.length === 0 ? (
                <p className="text-slate-400 text-sm">No activity yet</p>
              ) : (
                <div className="space-y-3">
                  {[...interactions.slice(0, 3).map(i => ({ ...i, _type: 'interaction' })), ...notes.slice(0, 3).map(n => ({ ...n, _type: 'note' }))]
                    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                    .slice(0, 5)
                    .map((item) => (
                      <div key={`${item._type}-${item.id}`} className="text-sm">
                        <div className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full ${item._type === 'note' ? 'bg-blue-500' : 'bg-emerald-500'}`} />
                          <p className="text-slate-800 truncate flex-1">
                            {item._type === 'interaction' ? (item.subject || 'Interaction') : (item.content?.substring(0, 60) || 'Note')}
                          </p>
                        </div>
                        <p className="text-slate-400 text-xs ml-3.5 mt-0.5">
                          {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notes Tab */}
        {activeTab === 'Notes' && (
          <div className="space-y-4">
            <button onClick={() => setShowNoteForm(!showNoteForm)} className={btnPrimary}>
              <Plus size={16} /> Add Note
            </button>

            {showNoteForm && (
              <form onSubmit={handleAddNote} className="glass-card p-5">
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Write a note..."
                  className="input-base w-full resize-none h-24"
                />
                <div className="flex gap-2 mt-3">
                  <button type="submit" className={btnPrimary}>Save Note</button>
                  <button type="button" onClick={() => { setShowNoteForm(false); setNewNote(''); }} className={btnSecondary}>Cancel</button>
                </div>
              </form>
            )}

            {notes.length === 0 ? (
              <div className="text-center py-8 text-slate-400">No notes yet</div>
            ) : (
              <div className="space-y-3">
                {notes.map((note) => (
                  <div key={note.id} className="glass-card p-4">
                    <p className="text-slate-800 text-sm whitespace-pre-wrap">{note.content}</p>
                    <div className="flex gap-3 mt-2 text-xs text-slate-400">
                      <span>{formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}</span>
                      {note.source && <span className="capitalize">{note.source}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tasks Tab */}
        {activeTab === 'Tasks' && (
          <div className="space-y-4">
            <button onClick={() => setShowTaskForm(!showTaskForm)} className={btnPrimary}>
              <Plus size={16} /> Add Task
            </button>

            {showTaskForm && (
              <form onSubmit={handleAddTask} className="glass-card p-5 space-y-3">
                <input
                  type="text"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  placeholder="Task title..."
                  className="input-base w-full"
                />
                <div className="grid grid-cols-3 gap-3">
                  <select value={newTask.priority} onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })} className="input-base">
                    <option>Low</option><option>Medium</option><option>High</option><option>Urgent</option>
                  </select>
                  <select value={newTask.status} onChange={(e) => setNewTask({ ...newTask, status: e.target.value })} className="input-base">
                    <option>Pending</option><option>In Progress</option><option>Completed</option>
                  </select>
                  <input type="date" value={newTask.dueDate} onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })} className="input-base" />
                </div>
                <div className="flex gap-2">
                  <button type="submit" className={btnPrimary}>Save Task</button>
                  <button type="button" onClick={() => { setShowTaskForm(false); setNewTask({ title: '', status: 'Pending', priority: 'Medium', dueDate: '' }); }} className={btnSecondary}>Cancel</button>
                </div>
              </form>
            )}

            {tasks.length === 0 ? (
              <div className="text-center py-8 text-slate-400">No tasks yet</div>
            ) : (
              <div className="space-y-3">
                {tasks.map((task) => (
                  <div key={task.id} className="glass-card p-4 flex items-start gap-3">
                    <button
                      onClick={() => handleToggleTask(task)}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 mt-0.5 cursor-pointer ${
                        task.status === 'Completed' ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 hover:border-indigo-500'
                      }`}
                    >
                      {task.status === 'Completed' && (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      )}
                    </button>
                    <div className="flex-1">
                      <p className={`text-slate-800 font-medium text-sm ${task.status === 'Completed' ? 'line-through text-slate-400' : ''}`}>{task.title}</p>
                      <div className="flex gap-2 mt-1.5 text-xs">
                        <span className={`px-2 py-0.5 rounded-full ${getPriorityColor(task.priority)}`}>{task.priority || 'Medium'}</span>
                        {task.due_date && <span className="text-slate-400">{format(new Date(task.due_date), 'MMM d, yyyy')}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Interactions Tab */}
        {activeTab === 'Interactions' && (
          <div className="space-y-4">
            <button onClick={() => setShowInteractionForm(!showInteractionForm)} className={btnPrimary}>
              <Plus size={16} /> Log Interaction
            </button>

            {showInteractionForm && (
              <form onSubmit={handleAddInteraction} className="glass-card p-5 space-y-3">
                <input
                  type="text"
                  value={newInteraction.subject}
                  onChange={(e) => setNewInteraction({ ...newInteraction, subject: e.target.value })}
                  placeholder="Subject..."
                  className="input-base w-full"
                />
                <textarea
                  value={newInteraction.content}
                  onChange={(e) => setNewInteraction({ ...newInteraction, content: e.target.value })}
                  placeholder="Details..."
                  rows="2"
                  className="input-base w-full resize-none"
                />
                <div className="grid grid-cols-2 gap-3">
                  <select value={newInteraction.channel} onChange={(e) => setNewInteraction({ ...newInteraction, channel: e.target.value })} className="input-base">
                    <option value="email">Email</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="instagram">Instagram</option>
                    <option value="linkedin">LinkedIn</option>
                    <option value="phone">Phone Call</option>
                    <option value="meeting">Meeting</option>
                    <option value="other">Other</option>
                  </select>
                  <select value={newInteraction.direction} onChange={(e) => setNewInteraction({ ...newInteraction, direction: e.target.value })} className="input-base">
                    <option value="outbound">Outbound</option>
                    <option value="inbound">Inbound</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button type="submit" className={btnPrimary}>Save</button>
                  <button type="button" onClick={() => { setShowInteractionForm(false); setNewInteraction({ subject: '', content: '', channel: 'email', direction: 'outbound' }); }} className={btnSecondary}>Cancel</button>
                </div>
              </form>
            )}

            {interactions.length === 0 ? (
              <div className="text-center py-8 text-slate-400">No interactions logged yet</div>
            ) : (
              <div className="space-y-3">
                {interactions.map((interaction) => (
                  <div key={interaction.id} className="glass-card p-4 flex gap-3">
                    <div className="pt-0.5">
                      {interaction.direction === 'inbound' ? (
                        <div className="bg-emerald-100 p-1.5 rounded-lg">
                          <ArrowDownLeft size={16} className="text-emerald-600" />
                        </div>
                      ) : (
                        <div className="bg-blue-100 p-1.5 rounded-lg">
                          <ArrowUpRight size={16} className="text-blue-600" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-800 font-medium text-sm">{interaction.subject || 'Interaction'}</p>
                      {interaction.content && <p className="text-slate-500 text-sm mt-1 line-clamp-2">{interaction.content}</p>}
                      <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                        {interaction.channel && <span className="capitalize">{interaction.channel}</span>}
                        <span>{formatDistanceToNow(new Date(interaction.created_at), { addSuffix: true })}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Deals Tab */}
        {activeTab === 'Deals' && (
          <div className="space-y-3">
            {deals.length === 0 ? (
              <div className="text-center py-8 text-slate-400">No deals associated with this contact</div>
            ) : (
              deals.map((deal) => (
                <div key={deal.id} className="glass-card p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-slate-800 font-medium">{deal.title}</p>
                      {deal.value > 0 && <p className="text-slate-900 text-lg font-semibold mt-1">{'\u00A3'}{deal.value.toLocaleString()}</p>}
                      {deal.description && <p className="text-slate-500 text-sm mt-1">{deal.description}</p>}
                    </div>
                    <div className="flex gap-2">
                      {deal.stage && (
                        <span className="px-2.5 py-1 rounded-full text-xs bg-indigo-100 text-indigo-700 capitalize">{deal.stage}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Edit Contact Modal */}
      {showEditModal && (
        <Modal title="Edit Contact" onClose={() => setShowEditModal(false)}>
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">First Name</label>
                <input type="text" required value={editForm.first_name} onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                  className="input-base w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Last Name</label>
                <input type="text" required value={editForm.last_name} onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                  className="input-base w-full" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                className="input-base w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone</label>
              <input type="tel" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                className="input-base w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Company</label>
              <input type="text" value={editForm.company} onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                className="input-base w-full" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Source</label>
                <select value={editForm.source} onChange={(e) => setEditForm({ ...editForm, source: e.target.value })} className="input-base w-full">
                  <option value="manual">Manual</option><option value="instagram">Instagram</option>
                  <option value="whatsapp">WhatsApp</option><option value="gmail">Gmail</option>
                  <option value="outlook">Outlook</option><option value="linkedin">LinkedIn</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Status</label>
                <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} className="input-base w-full">
                  <option value="lead">Lead</option><option value="active">Active</option>
                  <option value="client">Client</option><option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Tags</label>
              <input type="text" value={editForm.tags} onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
                placeholder="Comma-separated tags" className="input-base w-full" />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-xl transition-all duration-200 cursor-pointer shadow-lg shadow-indigo-500/25">
                Save Changes
              </button>
              <button type="button" onClick={() => setShowEditModal(false)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2.5 rounded-xl transition-all duration-200 cursor-pointer">
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
