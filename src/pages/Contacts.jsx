import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';
import {
  getColorFromHash, getInitials, getStatusBadgeColor, formatRelativeDate, getContactFullName,
} from '../lib/utils';
import {
  Plus, Search, Camera, MessageCircle, Mail, Globe, AlertCircle,
  LayoutGrid, List, ChevronDown, ChevronRight, Building2, X, Filter,
  ArrowUpDown, Trash2,
} from 'lucide-react';

const SOURCE_ICONS = {
  manual: null,
  instagram: Camera,
  whatsapp: MessageCircle,
  gmail: Mail,
  outlook: Mail,
  linkedin: Globe,
};

export default function Contacts() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilters, setStatusFilters] = useState(['All']);
  const [sourceFilter, setSourceFilter] = useState('All');
  const [sortBy, setSortBy] = useState('Newest');
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('contacts-view') || 'table');
  const [groupByCompany, setGroupByCompany] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState(new Set());
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', email: '', phone: '', company: '',
    source: 'manual', status: 'lead', tags: '',
  });

  useEffect(() => {
    fetchContacts();
  }, []);

  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setShowAddModal(true);
    }
  }, [searchParams]);

  useEffect(() => {
    localStorage.setItem('contacts-view', viewMode);
  }, [viewMode]);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setContacts(data || []);
    } catch (error) {
      console.error('Error fetching contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  // Collect all unique tags and sources
  const allTags = useMemo(() => {
    const tags = new Set();
    contacts.forEach(c => (c.tags || []).forEach(t => tags.add(t)));
    return [...tags].sort();
  }, [contacts]);

  const allSources = useMemo(() => {
    const sources = new Set();
    contacts.forEach(c => sources.add(c.source || 'manual'));
    return [...sources].sort();
  }, [contacts]);

  // Status counts
  const statusCounts = useMemo(() => {
    const counts = { All: contacts.length, Lead: 0, Active: 0, Client: 0, Inactive: 0 };
    contacts.forEach(c => {
      const s = (c.status || '').charAt(0).toUpperCase() + (c.status || '').slice(1).toLowerCase();
      if (counts[s] !== undefined) counts[s]++;
    });
    return counts;
  }, [contacts]);

  // Filtered and sorted contacts
  const filteredContacts = useMemo(() => {
    let filtered = contacts;

    // Status filter
    if (!statusFilters.includes('All')) {
      filtered = filtered.filter(c =>
        statusFilters.some(sf => (c.status || '').toLowerCase() === sf.toLowerCase())
      );
    }

    // Source filter
    if (sourceFilter !== 'All') {
      filtered = filtered.filter(c => (c.source || 'manual') === sourceFilter);
    }

    // Search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(c =>
        (c.first_name || '').toLowerCase().includes(term) ||
        (c.last_name || '').toLowerCase().includes(term) ||
        (c.email || '').toLowerCase().includes(term) ||
        (c.company || '').toLowerCase().includes(term) ||
        (c.tags || []).some(t => t.toLowerCase().includes(term))
      );
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'Oldest': return new Date(a.created_at) - new Date(b.created_at);
        case 'A-Z': return (getContactFullName(a)).localeCompare(getContactFullName(b));
        case 'Z-A': return (getContactFullName(b)).localeCompare(getContactFullName(a));
        case 'Company': return (a.company || 'zzz').localeCompare(b.company || 'zzz');
        default: return new Date(b.created_at) - new Date(a.created_at);
      }
    });

    return filtered;
  }, [contacts, statusFilters, sourceFilter, searchTerm, sortBy]);

  // Company groups
  const companyGroups = useMemo(() => {
    if (!groupByCompany) return null;
    const groups = {};
    filteredContacts.forEach(c => {
      const company = c.company || 'Ungrouped';
      if (!groups[company]) groups[company] = [];
      groups[company].push(c);
    });
    return Object.entries(groups).sort((a, b) => {
      if (a[0] === 'Ungrouped') return 1;
      if (b[0] === 'Ungrouped') return -1;
      return a[0].localeCompare(b[0]);
    });
  }, [filteredContacts, groupByCompany]);

  const toggleStatus = (status) => {
    if (status === 'All') {
      setStatusFilters(['All']);
    } else {
      setStatusFilters(prev => {
        const without = prev.filter(s => s !== 'All' && s !== status);
        if (prev.includes(status)) {
          return without.length > 0 ? without : ['All'];
        }
        return [...without, status];
      });
    }
  };

  const toggleGroup = (company) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(company)) next.delete(company);
      else next.add(company);
      return next;
    });
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredContacts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredContacts.map(c => c.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Delete ${selectedIds.size} contact(s)?`)) return;
    try {
      for (const id of selectedIds) {
        await supabase.from('contacts').delete().eq('id', id);
      }
      setSelectedIds(new Set());
      fetchContacts();
    } catch (error) {
      console.error('Error deleting contacts:', error);
    }
  };

  const handleBulkStatusChange = async (newStatus) => {
    try {
      for (const id of selectedIds) {
        await supabase.from('contacts').update({ status: newStatus }).eq('id', id);
      }
      setSelectedIds(new Set());
      fetchContacts();
    } catch (error) {
      console.error('Error updating contacts:', error);
    }
  };

  const handleAddContact = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('contacts').insert([{
        first_name: formData.firstName,
        last_name: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        company: formData.company,
        source: formData.source,
        status: formData.status,
        tags: formData.tags.split(',').map(t => t.trim()).filter(t => t),
      }]);
      if (error) throw error;
      setFormData({ firstName: '', lastName: '', email: '', phone: '', company: '', source: 'manual', status: 'lead', tags: '' });
      setShowAddModal(false);
      toast.success('Contact added');
      fetchContacts();
    } catch (error) {
      console.error('Error adding contact:', error);
      toast.error(error.message || 'Failed to add contact');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const activeFilterCount = (statusFilters.includes('All') ? 0 : statusFilters.length) + (sourceFilter !== 'All' ? 1 : 0);
  const tabs = ['All', 'Lead', 'Active', 'Client', 'Inactive'];

  const ContactCard = ({ contact }) => {
    const SourceIcon = SOURCE_ICONS[contact.source];
    return (
      <div
        className="card card-interactive p-4 cursor-pointer"
        onClick={() => navigate(`/contacts/${contact.id}`)}
      >
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0"
            style={{ backgroundColor: getColorFromHash(`${contact.first_name}${contact.last_name}`) }}
          >
            {getInitials(contact.first_name, contact.last_name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-text font-medium text-sm truncate">
              {contact.first_name} {contact.last_name}
            </p>
            {contact.company && (
              <p className="text-text-muted text-xs truncate flex items-center gap-1 mt-0.5">
                <Building2 size={11} />
                {contact.company}
              </p>
            )}
            <p className="text-text-subtle text-xs truncate mt-0.5">{contact.email || 'No email'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <span className={`badge ${getStatusBadgeColor(contact.status)}`}>
            {contact.status ? contact.status.charAt(0).toUpperCase() + contact.status.slice(1) : 'Unknown'}
          </span>
          {SourceIcon && (
            <span className="text-text-subtle">
              <SourceIcon size={12} />
            </span>
          )}
          {contact.tags?.slice(0, 2).map((tag, i) => (
            <span key={i} className="badge bg-primary-50 text-primary-700">{tag}</span>
          ))}
        </div>
        <p className="text-text-subtle text-xs mt-2">{formatRelativeDate(contact.created_at)}</p>
      </div>
    );
  };

  const ContactRow = ({ contact }) => {
    const SourceIcon = SOURCE_ICONS[contact.source];
    return (
      <tr
        onClick={() => navigate(`/contacts/${contact.id}`)}
        className="hover:bg-surface cursor-pointer transition-colors border-b border-border-subtle last:border-b-0"
      >
        <td className="px-4 py-3">
          <input
            type="checkbox"
            checked={selectedIds.has(contact.id)}
            onChange={(e) => { e.stopPropagation(); toggleSelect(contact.id); }}
            className="rounded border-border cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          />
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white font-medium text-xs flex-shrink-0"
              style={{ backgroundColor: getColorFromHash(`${contact.first_name}${contact.last_name}`) }}
            >
              {getInitials(contact.first_name, contact.last_name)}
            </div>
            <span className="text-text font-medium text-sm">{contact.first_name} {contact.last_name}</span>
          </div>
        </td>
        <td className="px-4 py-3 text-text-muted text-sm hidden md:table-cell">{contact.email || '—'}</td>
        <td className="px-4 py-3 text-text-muted text-sm hidden lg:table-cell">{contact.company || '—'}</td>
        <td className="px-4 py-3 hidden lg:table-cell">
          <div className="flex items-center gap-1.5">
            {SourceIcon && <SourceIcon size={13} className="text-text-subtle" />}
            <span className="text-text-muted text-sm capitalize">{contact.source || 'manual'}</span>
          </div>
        </td>
        <td className="px-4 py-3">
          <span className={`badge ${getStatusBadgeColor(contact.status)}`}>
            {contact.status ? contact.status.charAt(0).toUpperCase() + contact.status.slice(1) : 'Unknown'}
          </span>
        </td>
        <td className="px-4 py-3 text-text-subtle text-xs hidden md:table-cell">{formatRelativeDate(contact.created_at)}</td>
      </tr>
    );
  };

  const renderContacts = (contactList) => {
    // Always show card view on mobile
    if (viewMode === 'card' || window.innerWidth < 640) {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {contactList.map(contact => <ContactCard key={contact.id} contact={contact} />)}
        </div>
      );
    }

    return (
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-surface">
                <th className="px-4 py-2.5 text-left w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filteredContacts.length && filteredContacts.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-border cursor-pointer"
                  />
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-subtle uppercase tracking-wider">Name</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-subtle uppercase tracking-wider hidden md:table-cell">Email</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-subtle uppercase tracking-wider hidden lg:table-cell">Company</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-subtle uppercase tracking-wider hidden lg:table-cell">Source</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-subtle uppercase tracking-wider">Status</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-subtle uppercase tracking-wider hidden md:table-cell">Added</th>
              </tr>
            </thead>
            <tbody>
              {contactList.map(contact => <ContactRow key={contact.id} contact={contact} />)}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-text">Contacts</h1>
          <p className="text-text-muted text-sm mt-0.5">
            {filteredContacts.length} of {contacts.length} contact{contacts.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-primary flex-shrink-0">
          <Plus size={16} /> <span className="hidden sm:inline">Add Contact</span><span className="sm:hidden">Add</span>
        </button>
      </div>

      {/* Search + View Controls */}
      <div className="flex gap-2 sm:gap-3 items-center flex-wrap">
        <div className="relative w-full sm:flex-1 sm:min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" />
          <input
            type="text"
            placeholder="Search contacts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-base pl-9"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`btn-secondary text-xs ${activeFilterCount > 0 ? 'border-primary-300 text-primary-600' : ''}`}
        >
          <Filter size={14} />
          <span className="hidden sm:inline">Filters</span>
          {activeFilterCount > 0 && (
            <span className="bg-primary-600 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
        <button
          onClick={() => { setGroupByCompany(!groupByCompany); setCollapsedGroups(new Set()); }}
          className={`btn-secondary text-xs hidden sm:inline-flex ${groupByCompany ? 'border-primary-300 text-primary-600' : ''}`}
        >
          <Building2 size={14} /> Group by Company
        </button>
        <div className="hidden sm:flex items-center gap-1 border border-border rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('table')}
            className={`p-1.5 rounded-md transition-colors cursor-pointer ${viewMode === 'table' ? 'bg-primary-50 text-primary-600' : 'text-text-subtle hover:text-text'}`}
          >
            <List size={16} />
          </button>
          <button
            onClick={() => setViewMode('card')}
            className={`p-1.5 rounded-md transition-colors cursor-pointer ${viewMode === 'card' ? 'bg-primary-50 text-primary-600' : 'text-text-subtle hover:text-text'}`}
          >
            <LayoutGrid size={16} />
          </button>
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="input-base text-xs w-auto py-1.5 pr-8"
        >
          <option>Newest</option>
          <option>Oldest</option>
          <option>A-Z</option>
          <option>Z-A</option>
          <option>Company</option>
        </select>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => toggleStatus(tab)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
              (tab === 'All' && statusFilters.includes('All')) || statusFilters.includes(tab)
                ? 'bg-primary-600 text-white'
                : 'bg-surface-card text-text-muted hover:bg-surface border border-border'
            }`}
          >
            {tab === 'Lead' ? 'Leads' : tab === 'Client' ? 'Clients' : tab}
            <span className="ml-1 opacity-70">({statusCounts[tab] || 0})</span>
          </button>
        ))}
      </div>

      {/* Advanced Filters */}
      {showFilters && (
        <div className="card p-4 flex gap-4 items-end flex-wrap">
          <div>
            <label className="text-xs font-medium text-text-muted mb-1.5 block">Source</label>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="input-base text-sm py-1.5"
            >
              <option value="All">All Sources</option>
              {allSources.map(s => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => { setStatusFilters(['All']); setSourceFilter('All'); setSearchTerm(''); setSortBy('Newest'); }}
            className="btn-ghost text-xs py-1.5"
          >
            Reset All
          </button>
        </div>
      )}

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="card p-3 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 bg-primary-50 border-primary-200">
          <span className="text-sm font-medium text-primary-700">{selectedIds.size} selected</span>
          <div className="flex gap-2 sm:ml-auto flex-wrap">
            <select
              onChange={(e) => { if (e.target.value) handleBulkStatusChange(e.target.value); e.target.value = ''; }}
              className="input-base text-xs py-1 w-auto"
              defaultValue=""
            >
              <option value="" disabled>Change Status</option>
              <option value="lead">Lead</option>
              <option value="active">Active</option>
              <option value="client">Client</option>
              <option value="inactive">Inactive</option>
            </select>
            <button onClick={handleBulkDelete} className="btn-danger text-xs py-1">
              <Trash2 size={13} /> Delete
            </button>
            <button onClick={() => setSelectedIds(new Set())} className="btn-ghost text-xs py-1">
              <X size={13} /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="card p-6">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-3">
              <div className="skeleton w-8 h-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-4 w-40" />
                <div className="skeleton h-3 w-56" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredContacts.length === 0 ? (
        <div className="card p-8 text-center">
          <AlertCircle size={28} className="mx-auto text-text-subtle mb-2" />
          <p className="text-text-muted text-sm">
            {contacts.length === 0 ? 'No contacts yet. Add your first contact to get started.' : 'No contacts match your filters.'}
          </p>
        </div>
      ) : groupByCompany && companyGroups ? (
        <div className="space-y-3">
          {companyGroups.map(([company, companyContacts]) => (
            <div key={company} className="card overflow-hidden">
              <button
                onClick={() => toggleGroup(company)}
                className="w-full flex items-center gap-3 px-4 py-3 bg-surface hover:bg-border-subtle transition-colors cursor-pointer text-left"
              >
                {collapsedGroups.has(company) ? <ChevronRight size={16} className="text-text-subtle" /> : <ChevronDown size={16} className="text-text-subtle" />}
                <Building2 size={15} className="text-text-muted" />
                <span className="font-medium text-sm text-text">{company}</span>
                <span className="text-xs text-text-subtle ml-1">({companyContacts.length})</span>
              </button>
              {!collapsedGroups.has(company) && (
                <div className="px-4 pb-3">
                  {viewMode === 'card' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-3">
                      {companyContacts.map(c => <ContactCard key={c.id} contact={c} />)}
                    </div>
                  ) : (
                    <div className="divide-y divide-border-subtle">
                      {companyContacts.map(contact => {
                        const SourceIcon = SOURCE_ICONS[contact.source];
                        return (
                          <div
                            key={contact.id}
                            className="flex items-center gap-3 py-2.5 px-1 hover:bg-surface rounded-md cursor-pointer transition-colors"
                            onClick={() => navigate(`/contacts/${contact.id}`)}
                          >
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-white font-medium text-xs flex-shrink-0"
                              style={{ backgroundColor: getColorFromHash(`${contact.first_name}${contact.last_name}`) }}
                            >
                              {getInitials(contact.first_name, contact.last_name)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-text font-medium text-sm">{contact.first_name} {contact.last_name}</p>
                              <p className="text-text-subtle text-xs truncate">{contact.email || 'No email'}</p>
                            </div>
                            <span className={`badge ${getStatusBadgeColor(contact.status)}`}>
                              {contact.status ? contact.status.charAt(0).toUpperCase() + contact.status.slice(1) : 'Unknown'}
                            </span>
                            <span className="text-text-subtle text-xs">{formatRelativeDate(contact.created_at)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        renderContacts(filteredContacts)
      )}

      {/* Add Contact Modal */}
      {showAddModal && (
        <Modal title="Add New Contact" onClose={() => setShowAddModal(false)}>
          <form onSubmit={handleAddContact} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">First Name *</label>
                <input type="text" name="firstName" value={formData.firstName} onChange={handleInputChange} required className="input-base" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Last Name *</label>
                <input type="text" name="lastName" value={formData.lastName} onChange={handleInputChange} required className="input-base" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Email</label>
              <input type="email" name="email" value={formData.email} onChange={handleInputChange} className="input-base" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Phone</label>
              <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} className="input-base" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Company</label>
              <input type="text" name="company" value={formData.company} onChange={handleInputChange} className="input-base" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Source</label>
                <select name="source" value={formData.source} onChange={handleInputChange} className="input-base">
                  <option value="manual">Manual</option>
                  <option value="instagram">Instagram</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="gmail">Gmail</option>
                  <option value="outlook">Outlook</option>
                  <option value="linkedin">LinkedIn</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Status</label>
                <select name="status" value={formData.status} onChange={handleInputChange} className="input-base">
                  <option value="lead">Lead</option>
                  <option value="active">Active</option>
                  <option value="client">Client</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Tags</label>
              <input type="text" name="tags" value={formData.tags} onChange={handleInputChange} placeholder="Comma-separated tags" className="input-base" />
            </div>
            <button type="submit" className="btn-primary w-full justify-center py-2.5">
              Save Contact
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
