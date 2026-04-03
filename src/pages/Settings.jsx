import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  Plus,
  Edit2,
  Trash2,
  ChevronUp,
  ChevronDown,
  MessageCircle,
  Mail,
  Globe,
  Download,
  Trash,
  AlertCircle
} from 'lucide-react';

const INTEGRATIONS = [
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    icon: MessageCircle,
    status: 'not_connected'
  },
  {
    id: 'instagram',
    name: 'Instagram',
    icon: MessageCircle,
    status: 'not_connected'
  },
  {
    id: 'gmail',
    name: 'Gmail',
    icon: Mail,
    status: 'not_connected'
  },
  {
    id: 'outlook',
    name: 'Outlook',
    icon: Mail,
    status: 'not_connected'
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    icon: Globe,
    status: 'not_connected'
  }
];

export default function Settings() {
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', color: '#3b82f6', position: 0 });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    fetchStages();
  }, []);

  const fetchStages = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('pipeline_stages')
        .select('*')
        .order('position', { ascending: true });

      if (error) throw error;
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

      const { error } = await supabase
        .from('pipeline_stages')
        .insert([{
          name: formData.name,
          color: formData.color,
          position: newPosition
        }]);

      if (error) throw error;

      setFormData({ name: '', color: '#3b82f6', position: 0 });
      setShowAddForm(false);
      await fetchStages();
    } catch (error) {
      console.error('Error adding stage:', error);
    }
  };

  const handleUpdateStage = async (id) => {
    try {
      const { error } = await supabase
        .from('pipeline_stages')
        .update({
          name: formData.name,
          color: formData.color
        })
        .eq('id', id);

      if (error) throw error;

      setEditingId(null);
      setFormData({ name: '', color: '#3b82f6', position: 0 });
      await fetchStages();
    } catch (error) {
      console.error('Error updating stage:', error);
    }
  };

  const handleDeleteStage = async (id) => {
    try {
      const { error } = await supabase
        .from('pipeline_stages')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchStages();
    } catch (error) {
      console.error('Error deleting stage:', error);
    }
  };

  const handleReorderStage = async (stage, direction) => {
    const currentIndex = stages.findIndex(s => s.id === stage.id);
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (targetIndex < 0 || targetIndex >= stages.length) return;

    const targetStage = stages[targetIndex];
    const tempPosition = stage.position;

    try {
      await supabase
        .from('pipeline_stages')
        .update({ position: targetStage.position })
        .eq('id', stage.id);

      await supabase
        .from('pipeline_stages')
        .update({ position: tempPosition })
        .eq('id', targetStage.id);

      await fetchStages();
    } catch (error) {
      console.error('Error reordering stages:', error);
    }
  };

  const handleEditStage = (stage) => {
    setEditingId(stage.id);
    setFormData({
      name: stage.name,
      color: stage.color || '#3b82f6',
      position: stage.position
    });
  };

  const handleExportContacts = async () => {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('*');

      if (error) throw error;

      if (!data || data.length === 0) {
        alert('No contacts to export');
        return;
      }

      const keys = Object.keys(data[0]);
      const csvContent = [
        keys.join(','),
        ...data.map(row => keys.map(key => {
          const value = row[key];
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
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
    } catch (error) {
      console.error('Error exporting contacts:', error);
      alert('Failed to export contacts');
    }
  };

  const handleClearAllData = async () => {
    try {
      const tables = ['contacts', 'deals', 'tasks', 'notes', 'pipeline_stages'];

      for (const table of tables) {
        await supabase.from(table).delete().neq('id', '');
      }

      setShowDeleteConfirm(false);
      alert('All data has been cleared');
      window.location.reload();
    } catch (error) {
      console.error('Error clearing data:', error);
      alert('Failed to clear data');
    }
  };

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://tokgukksskcmmfnmvhxo.supabase.co';

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 mt-1">Manage your CRM configuration and integrations</p>
      </div>

      {/* Pipeline Stages Section */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-slate-900">Pipeline Stages</h2>
          <button
            onClick={() => {
              setShowAddForm(!showAddForm);
              setEditingId(null);
              setFormData({ name: '', color: '#3b82f6', position: 0 });
            }}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl transition-all duration-200 shadow-md shadow-indigo-500/20 cursor-pointer"
          >
            <Plus size={18} />
            Add Stage
          </button>
        </div>

        {/* Add/Edit Form */}
        {(showAddForm || editingId) && (
          <div className="bg-white/50 border border-slate-200 rounded-xl p-4 mb-6">
            <div className="flex gap-4 items-end flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <label className="text-slate-600 text-sm block mb-2">Stage Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter stage name"
                  className="input-base w-full"
                />
              </div>
              <div className="flex-shrink-0">
                <label className="text-slate-600 text-sm block mb-2">Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-12 h-10 rounded-xl cursor-pointer border border-slate-200"
                  />
                  <span className="text-slate-500 text-sm">{formData.color}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (editingId) {
                      handleUpdateStage(editingId);
                    } else {
                      handleAddStage();
                    }
                  }}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl transition-all duration-200 font-medium cursor-pointer shadow-md shadow-emerald-500/20"
                >
                  {editingId ? 'Update' : 'Add'}
                </button>
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingId(null);
                    setFormData({ name: '', color: '#3b82f6', position: 0 });
                  }}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl transition-all duration-200 font-medium cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stages List */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton h-16 rounded-xl" />
            ))}
          </div>
        ) : stages.length === 0 ? (
          <div className="text-slate-400 text-center py-8">No pipeline stages created yet</div>
        ) : (
          <div className="space-y-3">
            {stages.map((stage, index) => (
              <div
                key={stage.id}
                className="flex items-center gap-4 bg-white/50 border border-slate-200/60 rounded-xl p-4 hover:border-indigo-200 transition-all duration-200"
              >
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0 shadow-sm"
                  style={{ backgroundColor: stage.color || '#3b82f6' }}
                />
                <div className="flex-1">
                  <p className="text-slate-800 font-medium">{stage.name}</p>
                  <p className="text-slate-400 text-sm">Position: {stage.position}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleReorderStage(stage, 'up')}
                    disabled={index === 0}
                    className={`p-2 rounded-lg transition-all duration-200 cursor-pointer ${
                      index === 0
                        ? 'text-slate-300 cursor-not-allowed'
                        : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                    }`}
                  >
                    <ChevronUp size={18} />
                  </button>
                  <button
                    onClick={() => handleReorderStage(stage, 'down')}
                    disabled={index === stages.length - 1}
                    className={`p-2 rounded-lg transition-all duration-200 cursor-pointer ${
                      index === stages.length - 1
                        ? 'text-slate-300 cursor-not-allowed'
                        : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                    }`}
                  >
                    <ChevronDown size={18} />
                  </button>
                  <button
                    onClick={() => handleEditStage(stage)}
                    className="p-2 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-all duration-200 cursor-pointer"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => handleDeleteStage(stage.id)}
                    className="p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-all duration-200 cursor-pointer"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Integration Status Section */}
      <div className="glass-card p-6">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Integration Status</h2>
        <p className="text-slate-500 mb-6 flex items-start gap-2 text-sm">
          <AlertCircle size={18} className="flex-shrink-0 mt-0.5 text-slate-400" />
          Connect your messaging accounts through Claude Desktop to automatically import contacts and conversations.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {INTEGRATIONS.map((integration) => {
            const Icon = integration.icon;
            return (
              <div
                key={integration.id}
                className="bg-white/50 border border-slate-200/60 rounded-xl p-4 flex items-center gap-4"
              >
                <div className="bg-slate-100 p-2.5 rounded-xl">
                  <Icon size={20} className="text-slate-500" />
                </div>
                <div className="flex-1">
                  <h3 className="text-slate-800 font-medium">{integration.name}</h3>
                  <p className="text-slate-400 text-sm flex items-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-red-400"></span>
                    Not Connected
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Claude Integration Info Section */}
      <div className="glass-card p-6 border-indigo-200/50">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Claude Desktop Integration</h2>
        <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 mb-4">
          <p className="text-slate-600 mb-3 text-sm">
            Upload screenshots of your chats in Claude Desktop, and Claude will automatically create contacts, tasks, and notes in your CRM. This enables seamless data synchronization between your AI conversations and your customer relationship management system.
          </p>
          <div className="bg-white/60 rounded-xl p-3 space-y-2 text-sm">
            <div>
              <span className="text-slate-400">Supabase Project URL:</span>
              <p className="text-slate-800 font-mono break-all mt-1">{supabaseUrl}</p>
            </div>
            <div className="mt-3">
              <span className="text-slate-400">Available Tables:</span>
              <ul className="text-slate-700 font-mono mt-1 space-y-1 ml-4 list-disc">
                <li>contacts</li>
                <li>deals</li>
                <li>tasks</li>
                <li>notes</li>
                <li>pipeline_stages</li>
                <li>interactions</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Data Management Section */}
      <div className="glass-card p-6">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Data Management</h2>
        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={handleExportContacts}
            className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-3 rounded-xl transition-all duration-200 font-medium flex-1 cursor-pointer"
          >
            <Download size={18} />
            Export Contacts as CSV
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 px-6 py-3 rounded-xl transition-all duration-200 font-medium flex-1 cursor-pointer border border-red-200"
          >
            <Trash size={18} />
            Clear All Data
          </button>
        </div>
      </div>

      {/* About Section */}
      <div className="glass-card p-6">
        <h2 className="text-xl font-bold text-slate-900 mb-4">About Smart CRM</h2>
        <div className="space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-4">
            <span className="text-slate-500">App Name</span>
            <span className="text-slate-800 font-medium">Smart CRM</span>
          </div>
          <div className="flex justify-between items-center border-b border-slate-100 pb-4">
            <span className="text-slate-500">Version</span>
            <span className="text-slate-800 font-medium">1.0.0</span>
          </div>
          <div className="flex justify-between items-center border-b border-slate-100 pb-4">
            <span className="text-slate-500">Built for</span>
            <span className="text-slate-800 font-medium">AI Image Services</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Powered by</span>
            <span className="text-slate-800 font-medium">Supabase + Claude AI</span>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 glass-modal-backdrop flex items-center justify-center p-4 z-50">
          <div className="glass-card bg-white/90 p-6 max-w-md w-full shadow-2xl shadow-red-500/10">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Clear All Data?</h3>
            <p className="text-slate-500 mb-6">
              This action will permanently delete all data from your CRM including contacts, deals, tasks, notes, and pipeline stages. This cannot be undone.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl transition-all duration-200 font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleClearAllData}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white px-4 py-2.5 rounded-xl transition-all duration-200 font-medium cursor-pointer shadow-lg shadow-red-500/25"
              >
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
