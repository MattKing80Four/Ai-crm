import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  getColorFromHash, getInitials, getStatusBadgeColor, getPriorityColor,
  formatRelativeDate, formatCurrency, getDueDateInfo, getContactFullName,
} from '../lib/utils';
import {
  Building2, Users, TrendingUp, CheckSquare, ArrowLeft,
  ChevronRight, PoundSterling, FileText, Search,
} from 'lucide-react';

export default function Projects() {
  const { company: companyParam } = useParams();
  const navigate = useNavigate();
  const [contacts, setContacts] = useState([]);
  const [deals, setDeals] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [notes, setNotes] = useState([]);
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [c, d, t, n, s] = await Promise.all([
        supabase.from('contacts').select('*').order('first_name'),
        supabase.from('deals').select('*').order('created_at', { ascending: false }),
        supabase.from('tasks').select('*').order('due_date', { ascending: true }),
        supabase.from('notes').select('*').order('created_at', { ascending: false }),
        supabase.from('pipeline_stages').select('*').order('position', { ascending: true }),
      ]);
      setContacts(c.data || []);
      setDeals(d.data || []);
      setTasks(t.data || []);
      setNotes(n.data || []);
      setStages(s.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Build project data grouped by company
  const projects = useMemo(() => {
    const companiesMap = {};

    // Group contacts by company
    contacts.forEach(contact => {
      const company = contact.company;
      if (!company) return;
      if (!companiesMap[company]) {
        companiesMap[company] = { name: company, contacts: [], contactIds: new Set(), deals: [], tasks: [], notes: [] };
      }
      companiesMap[company].contacts.push(contact);
      companiesMap[company].contactIds.add(contact.id);
    });

    // Assign deals to companies
    deals.forEach(deal => {
      if (!deal.contact_id) return;
      for (const proj of Object.values(companiesMap)) {
        if (proj.contactIds.has(deal.contact_id)) {
          proj.deals.push(deal);
          break;
        }
      }
    });

    // Assign tasks to companies
    tasks.forEach(task => {
      if (!task.contact_id) return;
      for (const proj of Object.values(companiesMap)) {
        if (proj.contactIds.has(task.contact_id)) {
          proj.tasks.push(task);
          break;
        }
      }
    });

    // Assign notes to companies
    notes.forEach(note => {
      if (!note.contact_id) return;
      for (const proj of Object.values(companiesMap)) {
        if (proj.contactIds.has(note.contact_id)) {
          proj.notes.push(note);
          break;
        }
      }
    });

    return Object.values(companiesMap)
      .map(proj => ({
        ...proj,
        totalValue: proj.deals.reduce((sum, d) => sum + (d.value || 0), 0),
        activeDeals: proj.deals.filter(d => d.status === 'active' || !d.status).length,
        wonDeals: proj.deals.filter(d => d.status === 'won').length,
        pendingTasks: proj.tasks.filter(t => t.status !== 'Completed' && t.status !== 'Cancelled').length,
        stageDistribution: stages.map(s => ({
          name: s.name,
          color: s.color || '#6366f1',
          count: proj.deals.filter(d => d.stage === s.name && (d.status === 'active' || !d.status)).length,
        })),
      }))
      .filter(p => p.deals.length > 0 || p.contacts.length > 1)
      .sort((a, b) => b.totalValue - a.totalValue);
  }, [contacts, deals, tasks, notes, stages]);

  const filteredProjects = useMemo(() => {
    if (!searchTerm) return projects;
    const term = searchTerm.toLowerCase();
    return projects.filter(p =>
      p.name.toLowerCase().includes(term) ||
      p.contacts.some(c => getContactFullName(c).toLowerCase().includes(term))
    );
  }, [projects, searchTerm]);

  const selectedProject = companyParam ? projects.find(p => p.name === decodeURIComponent(companyParam)) : null;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-8 w-48 mb-2" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card p-5">
              <div className="skeleton h-5 w-32 mb-3" />
              <div className="skeleton h-4 w-48 mb-2" />
              <div className="skeleton h-3 w-24" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Project Detail View
  if (selectedProject) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate('/projects')} className="flex items-center gap-1.5 text-primary-600 hover:text-primary-700 text-sm font-medium cursor-pointer">
          <ArrowLeft size={16} /> All Projects
        </button>

        {/* Project Header */}
        <div className="card p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center">
                  <Building2 size={24} className="text-primary-600" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-text">{selectedProject.name}</h1>
                  <p className="text-text-muted text-sm">{selectedProject.contacts.length} contacts · {selectedProject.deals.length} deals</p>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-text">{formatCurrency(selectedProject.totalValue)}</p>
              <p className="text-text-muted text-xs">total value</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="card p-3 text-center">
            <p className="text-text-muted text-xs">Active Deals</p>
            <p className="text-xl font-bold text-text">{selectedProject.activeDeals}</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-text-muted text-xs">Won Deals</p>
            <p className="text-xl font-bold text-emerald-600">{selectedProject.wonDeals}</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-text-muted text-xs">Pending Tasks</p>
            <p className="text-xl font-bold text-text">{selectedProject.pendingTasks}</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-text-muted text-xs">Notes</p>
            <p className="text-xl font-bold text-text">{selectedProject.notes.length}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Contacts */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-text mb-3 flex items-center gap-2">
              <Users size={15} /> Contacts
            </h2>
            <div className="space-y-2">
              {selectedProject.contacts.map(contact => (
                <div
                  key={contact.id}
                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-surface cursor-pointer transition-colors"
                  onClick={() => navigate(`/contacts/${contact.id}`)}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white font-medium text-xs"
                    style={{ backgroundColor: getColorFromHash(`${contact.first_name}${contact.last_name}`) }}
                  >
                    {getInitials(contact.first_name, contact.last_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-text text-sm font-medium">{getContactFullName(contact)}</p>
                    <p className="text-text-subtle text-xs truncate">{contact.email || 'No email'}</p>
                  </div>
                  <span className={`badge ${getStatusBadgeColor(contact.status)}`}>
                    {contact.status ? contact.status.charAt(0).toUpperCase() + contact.status.slice(1) : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Deals */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-text mb-3 flex items-center gap-2">
              <TrendingUp size={15} /> Deals
            </h2>
            {selectedProject.deals.length === 0 ? (
              <p className="text-text-subtle text-sm">No deals yet</p>
            ) : (
              <div className="space-y-2">
                {selectedProject.deals.map(deal => (
                  <div
                    key={deal.id}
                    className="flex items-center justify-between p-2.5 rounded-lg hover:bg-surface cursor-pointer transition-colors"
                    onClick={() => navigate('/pipeline')}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-text text-sm font-medium">{deal.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="badge bg-primary-50 text-primary-700">{deal.stage}</span>
                        {deal.status && deal.status !== 'active' && (
                          <span className={`badge ${deal.status === 'won' ? 'badge-won' : 'badge-lost'}`}>
                            {deal.status.charAt(0).toUpperCase() + deal.status.slice(1)}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-text font-semibold text-sm">{deal.value ? formatCurrency(deal.value) : '—'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tasks */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-text mb-3 flex items-center gap-2">
              <CheckSquare size={15} /> Tasks
            </h2>
            {selectedProject.tasks.length === 0 ? (
              <p className="text-text-subtle text-sm">No tasks yet</p>
            ) : (
              <div className="space-y-2">
                {selectedProject.tasks.slice(0, 10).map(task => {
                  const dueInfo = getDueDateInfo(task.due_date);
                  return (
                    <div key={task.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-surface transition-colors">
                      <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                        task.status === 'Completed' ? 'bg-primary-600 border-primary-600' : 'border-border-hover'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${task.status === 'Completed' ? 'line-through text-text-subtle' : 'text-text'}`}>
                          {task.title}
                        </p>
                      </div>
                      <span className={`badge ${getPriorityColor(task.priority)}`}>{task.priority}</span>
                      <span className={`text-xs ${dueInfo.color}`}>{dueInfo.text}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent Notes */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-text mb-3 flex items-center gap-2">
              <FileText size={15} /> Recent Notes
            </h2>
            {selectedProject.notes.length === 0 ? (
              <p className="text-text-subtle text-sm">No notes yet</p>
            ) : (
              <div className="space-y-2">
                {selectedProject.notes.slice(0, 5).map(note => (
                  <div key={note.id} className="p-2.5 rounded-lg bg-surface">
                    <p className="text-text text-sm line-clamp-2">{note.content}</p>
                    <p className="text-text-subtle text-xs mt-1">{formatRelativeDate(note.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Projects List View
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Projects</h1>
          <p className="text-text-muted text-sm mt-0.5">
            {projects.length} project{projects.length !== 1 ? 's' : ''} · Grouped by company
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" />
        <input
          type="text"
          placeholder="Search projects..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input-base pl-9"
        />
      </div>

      {projects.length === 0 ? (
        <div className="card p-8 text-center">
          <Building2 size={32} className="mx-auto text-text-subtle mb-3" />
          <h2 className="text-text font-semibold mb-1">No projects yet</h2>
          <p className="text-text-muted text-sm">
            Projects are automatically created when contacts with a company have associated deals.
            Add a company to your contacts and create deals to see projects here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map(project => (
            <div
              key={project.name}
              className="card card-interactive p-5 cursor-pointer"
              onClick={() => navigate(`/projects/${encodeURIComponent(project.name)}`)}
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                  <Building2 size={20} className="text-primary-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-text font-semibold text-sm truncate">{project.name}</h3>
                  <p className="text-text-subtle text-xs">{project.contacts.length} contacts</p>
                </div>
                <ChevronRight size={16} className="text-text-subtle flex-shrink-0" />
              </div>

              {/* Pipeline mini-bar */}
              {project.stageDistribution.some(s => s.count > 0) && (
                <div className="flex gap-0.5 h-2 rounded-full overflow-hidden mb-3">
                  {project.stageDistribution.map(s => (
                    s.count > 0 && (
                      <div
                        key={s.name}
                        className="flex-1 rounded-full"
                        style={{ backgroundColor: s.color }}
                        title={`${s.name}: ${s.count}`}
                      />
                    )
                  ))}
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-lg font-bold text-text">{project.deals.length}</p>
                  <p className="text-text-subtle text-[10px]">Deals</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-text">{formatCurrency(project.totalValue)}</p>
                  <p className="text-text-subtle text-[10px]">Value</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-text">{project.pendingTasks}</p>
                  <p className="text-text-subtle text-[10px]">Tasks</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
