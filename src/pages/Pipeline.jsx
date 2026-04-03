import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Modal from '../components/Modal';
import {
  Plus,
  MoreVertical,
  Edit2,
  Trash2,
  PoundSterling,
  User,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { format } from 'date-fns';

export default function Pipeline() {
  const [stages, setStages] = useState([]);
  const [deals, setDeals] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDealModal, setShowDealModal] = useState(false);
  const [editingDeal, setEditingDeal] = useState(null);
  const [activeMenu, setActiveMenu] = useState(null);
  const [draggedDeal, setDraggedDeal] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);

  const [formData, setFormData] = useState({
    title: '',
    value: '',
    contact_id: '',
    stage: '',
    status: 'active',
    description: '',
    expected_close: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [stagesRes, dealsRes, contactsRes] = await Promise.all([
        supabase.from('pipeline_stages').select('*').order('position', { ascending: true }),
        supabase.from('deals').select('*').order('created_at', { ascending: false }),
        supabase.from('contacts').select('id, first_name, last_name').order('first_name'),
      ]);

      setStages(stagesRes.data || []);
      setDeals(dealsRes.data || []);
      setContacts(contactsRes.data || []);
    } catch (error) {
      console.error('Error fetching pipeline data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDealsForStage = (stageName) => {
    return deals.filter(d => d.stage === stageName);
  };

  const getStageValue = (stageName) => {
    return getDealsForStage(stageName).reduce((sum, d) => sum + (d.value || 0), 0);
  };

  const getContactName = (contactId) => {
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return null;
    return `${contact.first_name || ''} ${contact.last_name || ''}`.trim();
  };

  const handleOpenModal = (deal = null, defaultStage = '') => {
    if (deal) {
      setEditingDeal(deal);
      setFormData({
        title: deal.title || '',
        value: deal.value || '',
        contact_id: deal.contact_id || '',
        stage: deal.stage || '',
        status: deal.status || 'active',
        description: deal.description || '',
        expected_close: deal.expected_close || '',
      });
    } else {
      setEditingDeal(null);
      setFormData({
        title: '',
        value: '',
        contact_id: '',
        stage: defaultStage || (stages[0]?.name || ''),
        status: 'active',
        description: '',
        expected_close: '',
      });
    }
    setShowDealModal(true);
    setActiveMenu(null);
  };

  const handleCloseModal = () => {
    setShowDealModal(false);
    setEditingDeal(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const dealData = {
        title: formData.title,
        value: formData.value ? parseFloat(formData.value) : null,
        contact_id: formData.contact_id || null,
        stage: formData.stage,
        status: formData.status,
        description: formData.description || null,
        expected_close: formData.expected_close || null,
      };

      if (editingDeal) {
        const { error } = await supabase
          .from('deals')
          .update(dealData)
          .eq('id', editingDeal.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('deals').insert(dealData);
        if (error) throw error;
      }

      await fetchData();
      handleCloseModal();
    } catch (error) {
      console.error('Error saving deal:', error);
      alert('Error saving deal. Please try again.');
    }
  };

  const handleDeleteDeal = async (dealId) => {
    if (!window.confirm('Are you sure you want to delete this deal?')) return;

    try {
      const { error } = await supabase.from('deals').delete().eq('id', dealId);
      if (error) throw error;
      await fetchData();
      setActiveMenu(null);
    } catch (error) {
      console.error('Error deleting deal:', error);
    }
  };

  const handleMoveDeal = async (dealId, newStage) => {
    try {
      const { error } = await supabase
        .from('deals')
        .update({ stage: newStage })
        .eq('id', dealId);
      if (error) throw error;
      await fetchData();
    } catch (error) {
      console.error('Error moving deal:', error);
    }
  };

  const handleDragStart = (e, deal) => {
    setDraggedDeal(deal);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', deal.id);
    setTimeout(() => {
      e.target.style.opacity = '0.5';
    }, 0);
  };

  const handleDragEnd = (e) => {
    e.target.style.opacity = '1';
    setDraggedDeal(null);
    setDragOverStage(null);
  };

  const handleDragOver = (e, stageName) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStage(stageName);
  };

  const handleDragLeave = () => {
    setDragOverStage(null);
  };

  const handleDrop = async (e, stageName) => {
    e.preventDefault();
    setDragOverStage(null);

    if (draggedDeal && draggedDeal.stage !== stageName) {
      await handleMoveDeal(draggedDeal.id, stageName);
    }
    setDraggedDeal(null);
  };

  const handleMoveToNextStage = async (deal) => {
    const currentIndex = stages.findIndex(s => s.name === deal.stage);
    if (currentIndex < stages.length - 1) {
      await handleMoveDeal(deal.id, stages[currentIndex + 1].name);
    }
  };

  const handleMoveToPrevStage = async (deal) => {
    const currentIndex = stages.findIndex(s => s.name === deal.stage);
    if (currentIndex > 0) {
      await handleMoveDeal(deal.id, stages[currentIndex - 1].name);
    }
  };

  const totalValue = deals.filter(d => d.status !== 'lost').reduce((sum, d) => sum + (d.value || 0), 0);
  const totalDeals = deals.length;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-9 w-48 mb-2" />
        <div className="flex gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="w-[300px] flex-shrink-0 glass-card p-4">
              <div className="skeleton h-5 w-24 mb-3" />
              <div className="skeleton h-3 w-16 mb-4" />
              {[...Array(3)].map((_, j) => (
                <div key={j} className="skeleton h-24 w-full mb-3 rounded-xl" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (stages.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-slate-900">Deal Pipeline</h1>
        <div className="glass-card p-8 text-center">
          <PoundSterling size={40} className="mx-auto text-slate-300 mb-3" />
          <h2 className="text-lg font-semibold text-slate-900 mb-2">No pipeline stages set up</h2>
          <p className="text-slate-500 mb-4">Go to Settings to create your pipeline stages first.</p>
          <a
            href="/settings"
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl transition-all duration-200 shadow-lg shadow-indigo-500/25"
          >
            Go to Settings
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Deal Pipeline</h1>
          <p className="text-slate-500 mt-1">
            {totalDeals} deal{totalDeals !== 1 ? 's' : ''} · {'\u00A3'}{totalValue.toLocaleString()} total value
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl transition-all duration-200 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 cursor-pointer"
        >
          <Plus size={18} />
          New Deal
        </button>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: '60vh' }}>
        {stages.map((stage) => {
          const stageDeals = getDealsForStage(stage.name);
          const stageValue = getStageValue(stage.name);
          const isOver = dragOverStage === stage.name;

          return (
            <div
              key={stage.id}
              className={`flex-shrink-0 w-[300px] flex flex-col rounded-2xl border transition-all duration-200 ${
                isOver
                  ? 'border-indigo-400 bg-indigo-50/50 shadow-lg shadow-indigo-500/10'
                  : 'border-slate-200/60 bg-white/40 backdrop-blur-sm'
              }`}
              onDragOver={(e) => handleDragOver(e, stage.name)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, stage.name)}
            >
              {/* Stage Header */}
              <div className="p-4 border-b border-slate-200/60">
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0 shadow-sm"
                    style={{ backgroundColor: stage.color || '#3b82f6' }}
                  />
                  <h3 className="text-slate-800 font-semibold text-sm">{stage.name}</h3>
                  <span className="ml-auto bg-slate-100 text-slate-500 text-xs font-medium px-2 py-0.5 rounded-full">
                    {stageDeals.length}
                  </span>
                </div>
                <p className="text-slate-400 text-xs">{'\u00A3'}{stageValue.toLocaleString()}</p>
              </div>

              {/* Cards Container */}
              <div className="flex-1 p-3 space-y-3 overflow-y-auto">
                {stageDeals.map((deal) => {
                  const contactName = getContactName(deal.contact_id);
                  const stageIndex = stages.findIndex(s => s.name === deal.stage);

                  return (
                    <div
                      key={deal.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, deal)}
                      onDragEnd={handleDragEnd}
                      className="glass-card bg-white/80 p-4 cursor-grab active:cursor-grabbing hover:shadow-lg hover:shadow-indigo-500/5 transition-all duration-200 group"
                    >
                      {/* Deal Title & Menu */}
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="text-slate-800 font-medium text-sm flex-1 pr-2">{deal.title}</h4>
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenu(activeMenu === deal.id ? null : deal.id);
                            }}
                            className="text-slate-300 hover:text-slate-500 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                          >
                            <MoreVertical size={16} />
                          </button>
                          {activeMenu === deal.id && (
                            <div className="absolute right-0 top-6 bg-white border border-slate-200 rounded-xl shadow-xl z-10 w-36 py-1 overflow-hidden">
                              <button
                                onClick={() => handleOpenModal(deal)}
                                className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-indigo-50 flex items-center gap-2 cursor-pointer"
                              >
                                <Edit2 size={14} /> Edit
                              </button>
                              <button
                                onClick={() => handleDeleteDeal(deal.id)}
                                className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer"
                              >
                                <Trash2 size={14} /> Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Deal Value */}
                      {deal.value > 0 && (
                        <p className="text-slate-900 font-semibold text-lg mb-2">
                          {'\u00A3'}{deal.value.toLocaleString()}
                        </p>
                      )}

                      {/* Description */}
                      {deal.description && (
                        <p className="text-slate-400 text-xs mb-3 line-clamp-2">{deal.description}</p>
                      )}

                      {/* Contact & Date */}
                      <div className="flex items-center gap-3 text-xs text-slate-400 mb-3">
                        {contactName && (
                          <span className="flex items-center gap-1">
                            <User size={12} />
                            {contactName}
                          </span>
                        )}
                        {deal.expected_close && (
                          <span className="flex items-center gap-1">
                            <Calendar size={12} />
                            {format(new Date(deal.expected_close), 'MMM d')}
                          </span>
                        )}
                      </div>

                      {/* Move Arrows */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {stageIndex > 0 && (
                          <button
                            onClick={() => handleMoveToPrevStage(deal)}
                            className="flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                            title={`Move to ${stages[stageIndex - 1].name}`}
                          >
                            <ChevronLeft size={12} />
                            {stages[stageIndex - 1].name}
                          </button>
                        )}
                        {stageIndex < stages.length - 1 && (
                          <button
                            onClick={() => handleMoveToNextStage(deal)}
                            className="flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 px-2 py-1 rounded-lg ml-auto transition-colors cursor-pointer"
                            title={`Move to ${stages[stageIndex + 1].name}`}
                          >
                            {stages[stageIndex + 1].name}
                            <ChevronRight size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Add Deal to Stage */}
                <button
                  onClick={() => handleOpenModal(null, stage.name)}
                  className="w-full border-2 border-dashed border-slate-200 rounded-xl p-3 text-slate-400 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all duration-200 flex items-center justify-center gap-2 text-sm cursor-pointer"
                >
                  <Plus size={16} />
                  Add Deal
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Deal Modal */}
      {showDealModal && (
        <Modal
          title={editingDeal ? 'Edit Deal' : 'New Deal'}
          onClose={handleCloseModal}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Deal Title *</label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="input-base w-full"
                placeholder="e.g. Product photography package"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Value ({'\u00A3'})</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  className="input-base w-full"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Stage</label>
                <select
                  value={formData.stage}
                  onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
                  className="input-base w-full"
                >
                  {stages.map((stage) => (
                    <option key={stage.id} value={stage.name}>{stage.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Contact</label>
              <select
                value={formData.contact_id}
                onChange={(e) => setFormData({ ...formData, contact_id: e.target.value })}
                className="input-base w-full"
              >
                <option value="">No contact linked</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.first_name} {c.last_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows="2"
                className="input-base w-full resize-none"
                placeholder="Deal details..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Expected Close</label>
                <input
                  type="date"
                  value={formData.expected_close}
                  onChange={(e) => setFormData({ ...formData, expected_close: e.target.value })}
                  className="input-base w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="input-base w-full"
                >
                  <option value="active">Active</option>
                  <option value="won">Won</option>
                  <option value="lost">Lost</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-xl transition-all duration-200 cursor-pointer shadow-lg shadow-indigo-500/25"
              >
                {editingDeal ? 'Update Deal' : 'Create Deal'}
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

      {/* Click outside to close menu */}
      {activeMenu && (
        <div className="fixed inset-0 z-0" onClick={() => setActiveMenu(null)} />
      )}
    </div>
  );
}
