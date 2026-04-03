import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  Plus, Edit2, Trash2, ChevronUp, ChevronDown, MessageCircle, Mail, Globe,
  Download, Trash, AlertCircle, Upload,
} from 'lucide-react';

const INTEGRATIONS = [
  { id: 'whatsapp', name: 'WhatsApp', icon: MessageCircle, status: 'not_connected' },
  { id: 'instagram', name: 'Instagram', icon: MessageCircle, status: 'not_connected' },
  { id: 'gmail', name: 'Gmail', icon: Mail, status: 'not_connected' },
  { id: 'outlook', name: 'Outlook', icon: Mail, status: 'not_connected' },
  { id: 'linkedin', name: 'LinkedIn', icon: Globe, status: 'not_connected' },
];

export default function Settings() {
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', color: '#6366f1', position: 0 });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activeSection, setActiveSection] = useState('pipeline');

  useEffect(() => { fetchStages(); }, []);

  const fetchStages = async () => {
    try {
      setLoading(true);
      const { data } = await supabase.from('pipeline_stages').select('*').order('position', { ascending: true });
      setStages(data || []);
    } catch (error) {
      console.error('Error fetching stages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddStage = async () => {
    if (!formData.name.trim()) return;
    try {
      const newPosition = stages.length > 0 ? Math.max(...stages.map(s => s.position || 0)) + 1 : 0;
      await supabase.from('pipeline_stages').insert([{ name: formData.name, color: formData.color, position: newPosition }]);
      setFormData({ name: '', color: '#6366f1', position: 0 });
      setShowAddForm(false);
      await fetchStages();
    } catch (error) { console.error('Error adding stage:', error); }
  };

  const handleUpdateStage = async (id) => {
    try {
      await supabase.from('pipeline_stages').update({ name: formData.name, color: formData.color }).eq('id', id);
      setEditingId(null);
      setFormData({ name: '', color: '#6366f1', position: 0 });
      await fetchStages();
    } catch (error) { console.error('Error updating stage:', error); }
  };

  const handleDeleteStage = async (id) => {
    try {
      await supabase.from('pipeline_stages').delete().eq('id', id);
      await fetchStages();
    } catch (error) { console.error('Error deleting stage:', error); }
  };

  const handleReorderStage = async (stage, direction) => {
    const currentIndex = stages.findIndex(s => s.id === stage.id);
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= stages.length) return;
    const targetStage = stages[targetIndex];
    try {
      await supabase.from('pipeline_stages').update({ position: targetStage.position }).eq('id', stage.id);
      await supabase.from('pipeline_stages').update({ position: stage.position }).eq('id', targetStage.id);
      await fetchStages();
    } catch (error) { console.error('Error reordering stages:', error); }
  };

  const handleEditStage = (stage) => {
    setEditingId(stage.id);
    setFormData({ name: stage.name, color: stage.color || '#6366f1', position: stage.position });
  };

  const handleExportContacts = async () => {
    try {
      const { data } = await supabase.from('contacts').select('*');
      if (!data || data.length === 0) { alert('No contacts to export'); return; }
      const keys = Object.keys(data[0]);
      const csvContent = [
        keys.join(','),
        ...data.map(row => keys.map(key => {
          const value = row[key];
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) return `"${value.replace(/"/g, '""')}"`;
          return value || '';
        }).join(','))
      ].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contacts-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) { console.error('Error exporting:', error); alert('Failed to export'); }
  };

  const handleImportCSV = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) { alert('CSV file is empty or has no data rows'); return; }
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const firstNameIdx = headers.findIndex(h => h === 'first_name' || h === 'firstname' || h === 'first name');
      const lastNameIdx = headers.findIndex(h => h === 'last_name' || h === 'lastname' || h === 'last name');
      const emailIdx = headers.findIndex(h => h === 'email');
      const phoneIdx = headers.findIndex(h => h === 'phone');
      const companyIdx = headers.findIndex(h => h === 'company');

      if (firstNameIdx === -1) { alert('CSV must have a "first_name" column'); return; }

      const contacts = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        if (!values[firstNameIdx]) continue;
        contacts.push({
          first_name: values[firstNameIdx],
          last_name: lastNameIdx >= 0 ? values[lastNameIdx] || '' : '',
          email: emailIdx >= 0 ? values[emailIdx] || null : null,
          phone: phoneIdx >= 0 ? values[phoneIdx] || null : null,
          company: companyIdx >= 0 ? values[companyIdx] || null : null,
          source: 'manual',
          status: 'lead',
        });
      }

      if (contacts.length === 0) { alert('No valid contacts found in CSV'); return; }
      const { error } = await supabase.from('contacts').insert(contacts);
      if (error) throw error;
      alert(`Successfully imported ${contacts.length} contacts`);
      e.target.value = '';
    } catch (error) {
      console.error('Error importing:', error);
      alert('Failed to import contacts');
    }
  };

  const handleClearAllData = async () => {
    try {
      for (const table of ['contacts', 'deals', 'tasks', 'notes', 'pipeline_stages']) {
        await supabase.from(table).delete().neq('id', '');
      }
      setShowDeleteConfirm(false);
      alert('All data has been cleared');
      window.location.reload();
    } catch (error) { console.error('Error clearing data:', error); alert('Failed to clear data'); }
  };

  const sections = [
    { id: 'pipeline', label: 'Pipeline Stages' },
    { id: 'integrations', label: 'Integrations' },
    { id: 'data', label: 'Data Management' },
    { id: 'about', label: 'About' },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-text">Settings</h1>
        <p className="text-text-muted text-sm mt-0.5">Manage your CRM configuration</p>
      </div>

      {/* Section Tabs */}
      <div className="border-b border-border overflow-x-auto">
        <div className="flex gap-0 -mb-px min-w-max">
          {sections.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                activeSection === s.id
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-text-muted hover:text-text hover:border-border-hover'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Pipeline Stages */}
      {activeSection === 'pipeline' && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-text">Pipeline Stages</h2>
            <button
              onClick={() => { setShowAddForm(!showAddForm); setEditingId(null); setFormData({ name: '', color: '#6366f1', position: 0 }); }}
              className="btn-primary text-xs"
            >
              <Plus size={14} /> Add Stage
            </button>
          </div>

          {(showAddForm || editingId) && (
            <div className="bg-surface rounded-lg p-4 mb-4 border border-border-subtle">
              <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                <div className="flex-1 min-w-0 sm:min-w-[180px]">
                  <label className="text-xs font-medium text-text-muted mb-1.5 block">Stage Name</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Enter stage name" className="input-base" />
                </div>
                <div>
                  <label className="text-xs font-medium text-text-muted mb-1.5 block">Color</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={formData.color} onChange={(e) => setFormData({ ...formData, color: e.target.value })} className="w-10 h-9 rounded-lg cursor-pointer border border-border" />
                    <span className="text-text-subtle text-xs">{formData.color}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => editingId ? handleUpdateStage(editingId) : handleAddStage()} className="btn-primary text-xs">
                    {editingId ? 'Update' : 'Add'}
                  </button>
                  <button onClick={() => { setShowAddForm(false); setEditingId(null); }} className="btn-secondary text-xs">Cancel</button>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-14 rounded-lg" />)}
            </div>
          ) : stages.length === 0 ? (
            <div className="text-text-subtle text-center py-8 text-sm">No pipeline stages created yet</div>
          ) : (
            <div className="space-y-2">
              {stages.map((stage, index) => (
                <div key={stage.id} className="flex items-center gap-3 bg-surface rounded-lg p-3 border border-border-subtle hover:border-border-hover transition-colors">
                  <div className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color || '#6366f1' }} />
                  <div className="flex-1">
                    <p className="text-text text-sm font-medium">{stage.name}</p>
                    <p className="text-text-subtle text-xs">Position {index + 1}</p>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <button onClick={() => handleReorderStage(stage, 'up')} disabled={index === 0}
                      className={`p-1.5 rounded cursor-pointer ${index === 0 ? 'text-text-subtle opacity-30' : 'text-text-subtle hover:bg-surface-card hover:text-text'}`}>
                      <ChevronUp size={16} />
                    </button>
                    <button onClick={() => handleReorderStage(stage, 'down')} disabled={index === stages.length - 1}
                      className={`p-1.5 rounded cursor-pointer ${index === stages.length - 1 ? 'text-text-subtle opacity-30' : 'text-text-subtle hover:bg-surface-card hover:text-text'}`}>
                      <ChevronDown size={16} />
                    </button>
                    <button onClick={() => handleEditStage(stage)} className="p-1.5 text-text-subtle hover:text-primary-600 rounded cursor-pointer">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => handleDeleteStage(stage.id)} className="p-1.5 text-text-subtle hover:text-red-600 rounded cursor-pointer">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Integrations */}
      {activeSection === 'integrations' && (
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-text mb-4">Integration Status</h2>
            <p className="text-text-muted text-sm mb-4 flex items-start gap-2">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5 text-text-subtle" />
              Connect your messaging accounts through Claude Desktop to automatically import contacts and conversations.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {INTEGRATIONS.map(integration => {
                const Icon = integration.icon;
                return (
                  <div key={integration.id} className="flex items-center gap-3 p-3 rounded-lg bg-surface border border-border-subtle">
                    <div className="bg-surface-card p-2 rounded-lg border border-border-subtle">
                      <Icon size={18} className="text-text-muted" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-text text-sm font-medium">{integration.name}</h3>
                      <p className="text-text-subtle text-xs flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                        Not Connected
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card p-5">
            <h2 className="text-sm font-semibold text-text mb-3">Claude Desktop Integration</h2>
            <div className="bg-primary-50 rounded-lg p-4 border border-primary-100">
              <p className="text-text-secondary text-sm mb-3">
                Upload screenshots of your chats in Claude Desktop, and Claude will automatically create contacts, tasks, and notes in your CRM.
              </p>
              <div className="bg-surface-card rounded-lg p-3 text-sm space-y-2">
                <div>
                  <span className="text-text-subtle text-xs">Supabase Project URL:</span>
                  <p className="text-text font-mono text-xs break-all mt-0.5">{import.meta.env.VITE_SUPABASE_URL || 'https://tokgukksskcmmfnmvhxo.supabase.co'}</p>
                </div>
                <div>
                  <span className="text-text-subtle text-xs">Available Tables:</span>
                  <p className="text-text-muted font-mono text-xs mt-0.5">contacts, deals, tasks, notes, pipeline_stages, interactions</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Data Management */}
      {activeSection === 'data' && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-text mb-4">Data Management</h2>
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={handleExportContacts} className="btn-secondary flex-1 justify-center py-2.5">
                <Download size={16} /> Export Contacts (CSV)
              </button>
              <label className="btn-secondary flex-1 justify-center py-2.5 cursor-pointer">
                <Upload size={16} /> Import Contacts (CSV)
                <input type="file" accept=".csv" onChange={handleImportCSV} className="hidden" />
              </label>
            </div>
            <div className="border-t border-border-subtle pt-3">
              <button onClick={() => setShowDeleteConfirm(true)} className="btn-danger w-full justify-center py-2.5">
                <Trash size={16} /> Clear All Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* About */}
      {activeSection === 'about' && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-text mb-4">About Smart CRM</h2>
          <div className="space-y-3">
            {[
              ['App Name', 'Smart CRM'],
              ['Version', '2.0.0'],
              ['Built for', 'AI Image Services'],
              ['Powered by', 'Supabase + Claude AI'],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between items-center py-2 border-b border-border-subtle last:border-0">
                <span className="text-text-muted text-sm">{label}</span>
                <span className="text-text text-sm font-medium">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 glass-modal-backdrop flex items-center justify-center p-4 z-50">
          <div className="card bg-white p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-bold text-text mb-3">Clear All Data?</h3>
            <p className="text-text-muted text-sm mb-5">
              This will permanently delete all contacts, deals, tasks, notes, and pipeline stages. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="btn-secondary flex-1 justify-center py-2.5">Cancel</button>
              <button onClick={handleClearAllData} className="btn-danger flex-1 justify-center py-2.5">Delete All</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
