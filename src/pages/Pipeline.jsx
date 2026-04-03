import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';
import { formatCurrency, findContactName, getColorFromHash, getInitials } from '../lib/utils';
import {
  Plus, Edit2, Trash2, PoundSterling, User, Calendar, MoreVertical, Filter,
} from 'lucide-react';
import { format } from 'date-fns';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

export default function Pipeline() {
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const [stages, setStages] = useState([]);
  const [deals, setDeals] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDealModal, setShowDealModal] = useState(false);
  const [editingDeal, setEditingDeal] = useState(null);
  const [activeMenu, setActiveMenu] = useState(null);
  const [saving, setSaving] = useState(false);
  const [closedFilter, setClosedFilter] = useState('all');

  const [formData, setFormData] = useState({
    title: '', value: '', contact_id: '', stage_id: '',
    status: 'open', description: '', expected_close_date: '',
  });

  const isActive = (status) => status === 'active' || status === 'open' || !status;
  const getStageName = (stageId) => stages.find(s => s.id === stageId)?.name || '';
  const getStageId = (stageName) => stages.find(s => s.name === stageName)?.id || '';

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (searchParams.get('action') === 'new') setShowDealModal(true);
  }, [searchParams]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [s, d, c] = await Promise.all([
        supabase.from('pipeline_stages').select('*').order('position', { ascending: true }),
        supabase.from('deals').select('*').order('created_at', { ascending: false }),
        supabase.from('contacts').select('id, first_name, last_name').order('first_name'),
      ]);
      if (s.error) throw s.error;
      if (d.error) throw d.error;
      if (c.error) throw c.error;
      setStages(s.data || []);
      setDeals(d.data || []);
      setContacts(c.data || []);
    } catch (error) {
      console.error('Error fetching pipeline:', error);
      toast.error('Failed to load pipeline data');
    } finally {
      setLoading(false);
    }
  };

  const getDealsForStage = (stageId) => deals.filter(d => d.stage_id === stageId && isActive(d.status));
  const getStageValue = (stageId) => getDealsForStage(stageId).reduce((sum, d) => sum + (parseFloat(d.value) || 0), 0);

  const summary = useMemo(() => {
    const active = deals.filter(d => isActive(d.status));
    const totalValue = active.reduce((sum, d) => sum + (parseFloat(d.value) || 0), 0);
    const wonDeals = deals.filter(d => d.status === 'won');
    const wonValue = wonDeals.reduce((sum, d) => sum + (parseFloat(d.value) || 0), 0);
    const avgValue = active.length > 0 ? totalValue / active.length : 0;
    return { totalDeals: active.length, totalValue, wonDeals: wonDeals.length, wonValue, avgValue };
  }, [deals]);

  const closedDeals = useMemo(() => {
    const closed = deals.filter(d => d.status === 'won' || d.status === 'lost');
    if (closedFilter === 'won') return closed.filter(d => d.status === 'won');
    if (closedFilter === 'lost') return closed.filter(d => d.status === 'lost');
    return closed;
  }, [deals, closedFilter]);

  const handleOpenModal = (deal = null, defaultStageId = '') => {
    if (deal) {
      setEditingDeal(deal);
      setFormData({
        title: deal.title || '', value: deal.value || '', contact_id: deal.contact_id || '',
        stage_id: deal.stage_id || '', status: deal.status || 'open',
        description: deal.description || '', expected_close_date: deal.expected_close_date || '',
      });
    } else {
      setEditingDeal(null);
      setFormData({
        title: '', value: '', contact_id: '', stage_id: defaultStageId || (stages[0]?.id || ''),
        status: 'open', description: '', expected_close_date: '',
      });
    }
    setShowDealModal(true);
    setActiveMenu(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const dealData = {
        title: formData.title, value: formData.value ? parseFloat(formData.value) : null,
        contact_id: formData.contact_id || null, stage_id: formData.stage_id,
        status: formData.status, description: formData.description || null,
        expected_close_date: formData.expected_close_date || null,
      };
      if (editingDeal) {
        const { error } = await supabase.from('deals').update(dealData).eq('id', editingDeal.id);
        if (error) throw error;
        toast.success('Deal updated');
      } else {
        const { error } = await supabase.from('deals').insert(dealData);
        if (error) throw error;
        toast.success('Deal created');
      }
      await fetchData();
      setShowDealModal(false);
      setEditingDeal(null);
    } catch (error) {
      console.error('Error saving deal:', error);
      toast.error(error.message || 'Failed to save deal');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDeal = async (dealId) => {
    if (!window.confirm('Delete this deal?')) return;
    try {
      const { error } = await supabase.from('deals').delete().eq('id', dealId);
      if (error) throw error;
      toast.success('Deal deleted');
      await fetchData();
      setActiveMenu(null);
    } catch (error) {
      console.error('Error deleting deal:', error);
      toast.error(error.message || 'Failed to delete deal');
    }
  };

  const handleDragEnd = async (result) => {
    if (!result.destination) return;
    const dealId = result.draggableId;
    const newStageId = result.destination.droppableId;
    const deal = deals.find(d => d.id === dealId);
    if (!deal || deal.stage_id === newStageId) return;

    // Optimistic update
    setDeals(prev => prev.map(d => d.id === dealId ? { ...d, stage_id: newStageId } : d));
    try {
      const { error } = await supabase.from('deals').update({ stage_id: newStageId }).eq('id', dealId);
      if (error) throw error;
    } catch (error) {
      console.error('Error moving deal:', error);
      toast.error('Failed to move deal');
      fetchData(); // revert
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-8 w-48" />
        <div className="flex flex-col sm:flex-row gap-4 sm:overflow-x-auto">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="w-full sm:w-[280px] sm:flex-shrink-0 card p-4">
              <div className="skeleton h-5 w-24 mb-3" />
              {[...Array(3)].map((_, j) => <div key={j} className="skeleton h-24 w-full mb-3 rounded-lg" />)}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (stages.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-text">Deal Pipeline</h1>
        <div className="card p-8 text-center">
          <PoundSterling size={32} className="mx-auto text-text-subtle mb-3" />
          <h2 className="text-text font-semibold mb-1">No pipeline stages set up</h2>
          <p className="text-text-muted text-sm mb-4">Go to Settings to create your pipeline stages first.</p>
          <a href="/settings" className="btn-primary">Go to Settings</a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-text">Deal Pipeline</h1>
          <p className="text-text-muted text-sm mt-0.5 truncate">
            {summary.totalDeals} active deal{summary.totalDeals !== 1 ? 's' : ''} · {formatCurrency(summary.totalValue)} total
          </p>
        </div>
        <button onClick={() => handleOpenModal()} className="btn-primary flex-shrink-0">
          <Plus size={16} /> <span className="hidden sm:inline">New Deal</span><span className="sm:hidden">New</span>
        </button>
      </div>

      {/* Summary Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card p-3">
          <p className="text-text-muted text-xs">Pipeline Value</p>
          <p className="text-lg font-bold text-text">{formatCurrency(summary.totalValue)}</p>
        </div>
        <div className="card p-3">
          <p className="text-text-muted text-xs">Active Deals</p>
          <p className="text-lg font-bold text-text">{summary.totalDeals}</p>
        </div>
        <div className="card p-3">
          <p className="text-text-muted text-xs">Won Deals</p>
          <p className="text-lg font-bold text-emerald-600">{summary.wonDeals}</p>
        </div>
        <div className="card p-3">
          <p className="text-text-muted text-xs">Avg Deal Value</p>
          <p className="text-lg font-bold text-text">{formatCurrency(summary.avgValue)}</p>
        </div>
      </div>

      {/* Kanban Board */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex flex-col sm:flex-row gap-4 sm:overflow-x-auto pb-4" style={{ minHeight: '55vh' }}>
          {stages.map(stage => {
            const stageDeals = getDealsForStage(stage.id);
            const stageValue = getStageValue(stage.id);

            return (
              <Droppable key={stage.id} droppableId={stage.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`sm:flex-shrink-0 w-full sm:w-[280px] lg:w-[300px] flex flex-col rounded-xl border transition-colors ${
                      snapshot.isDraggingOver ? 'border-primary-300 bg-primary-50/50' : 'border-border bg-surface'
                    }`}
                  >
                    {/* Stage Header */}
                    <div className="p-3 border-b border-border-subtle">
                      <div className="flex items-center gap-2 mb-0.5">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color || '#6366f1' }} />
                        <h3 className="text-sm font-semibold text-text">{stage.name}</h3>
                        <span className="ml-auto text-xs text-text-subtle bg-surface-card border border-border-subtle rounded-full px-2 py-0.5">
                          {stageDeals.length}
                        </span>
                      </div>
                      <p className="text-text-subtle text-xs ml-4.5">{formatCurrency(stageValue)}</p>
                    </div>

                    {/* Cards */}
                    <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                      {stageDeals.map((deal, index) => {
                        const contactName = findContactName(contacts, deal.contact_id);
                        const stageIndex = stages.findIndex(s => s.id === deal.stage_id);
                        const progress = stages.length > 1 ? ((stageIndex + 1) / stages.length) * 100 : 100;

                        return (
                          <Draggable key={deal.id} draggableId={deal.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`card p-3 group ${snapshot.isDragging ? 'shadow-lg rotate-1' : ''}`}
                              >
                                <div className="flex items-start justify-between mb-2">
                                  <h4 className="text-sm font-medium text-text flex-1 pr-2">{deal.title}</h4>
                                  <div className="relative">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === deal.id ? null : deal.id); }}
                                      className="text-text-subtle hover:text-text sm:opacity-0 sm:group-hover:opacity-100 transition-all cursor-pointer"
                                    >
                                      <MoreVertical size={14} />
                                    </button>
                                    {activeMenu === deal.id && (
                                      <div className="absolute right-0 top-6 card shadow-lg z-10 w-32 py-1">
                                        <button onClick={() => handleOpenModal(deal)} className="w-full text-left px-3 py-1.5 text-xs text-text-secondary hover:bg-surface flex items-center gap-2 cursor-pointer">
                                          <Edit2 size={12} /> Edit
                                        </button>
                                        <button onClick={() => handleDeleteDeal(deal.id)} className="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer">
                                          <Trash2 size={12} /> Delete
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {deal.value > 0 && (
                                  <p className="text-text font-semibold text-base mb-2">{formatCurrency(deal.value)}</p>
                                )}

                                {deal.description && (
                                  <p className="text-text-subtle text-xs mb-2 line-clamp-2">{deal.description}</p>
                                )}

                                <div className="flex items-center gap-3 text-xs text-text-subtle mb-2">
                                  {contactName && (
                                    <span className="flex items-center gap-1">
                                      <User size={11} /> {contactName}
                                    </span>
                                  )}
                                  {deal.expected_close_date && (
                                    <span className="flex items-center gap-1">
                                      <Calendar size={11} /> {format(new Date(deal.expected_close_date), 'MMM d')}
                                    </span>
                                  )}
                                </div>

                                {/* Stage progress */}
                                <div className="h-1 bg-border-subtle rounded-full overflow-hidden group/progress relative">
                                  <div className="h-full bg-primary-400 rounded-full transition-all" style={{ width: `${progress}%` }} />
                                </div>
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}

                      <button
                        onClick={() => handleOpenModal(null, stage.id)}
                        className="w-full border border-dashed border-border-hover rounded-lg p-2.5 text-text-subtle hover:text-primary-600 hover:border-primary-300 transition-colors flex items-center justify-center gap-1.5 text-xs cursor-pointer"
                      >
                        <Plus size={14} /> Add Deal
                      </button>
                    </div>
                  </div>
                )}
              </Droppable>
            );
          })}
        </div>
      </DragDropContext>

      {/* Won/Lost Deals */}
      {closedDeals.length > 0 || deals.some(d => d.status === 'won' || d.status === 'lost') ? (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-text">Closed Deals</h2>
            <div className="flex gap-1">
              {['all', 'won', 'lost'].map(f => (
                <button
                  key={f}
                  onClick={() => setClosedFilter(f)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    closedFilter === f ? 'bg-primary-50 text-primary-600' : 'text-text-subtle hover:text-text'
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>
          {closedDeals.length === 0 ? (
            <p className="text-text-subtle text-sm text-center py-4">No {closedFilter} deals</p>
          ) : (
            <div className="space-y-2">
              {closedDeals.map(deal => (
                <div key={deal.id} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-surface transition-colors">
                  <div className="flex items-center gap-3">
                    <span className={`badge ${deal.status === 'won' ? 'badge-won' : 'badge-lost'}`}>
                      {deal.status === 'won' ? 'Won' : 'Lost'}
                    </span>
                    <span className="text-sm text-text">{deal.title}</span>
                  </div>
                  <span className="text-sm font-medium text-text">{deal.value ? formatCurrency(deal.value) : '—'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {/* Deal Modal */}
      {showDealModal && (
        <Modal title={editingDeal ? 'Edit Deal' : 'New Deal'} onClose={() => { setShowDealModal(false); setEditingDeal(null); }}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Deal Title *</label>
              <input type="text" required value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="input-base" placeholder="e.g. Product photography package" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Value (£)</label>
                <input type="number" step="0.01" min="0" value={formData.value} onChange={(e) => setFormData({ ...formData, value: e.target.value })} className="input-base" placeholder="0.00" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Stage</label>
                <select value={formData.stage_id} onChange={(e) => setFormData({ ...formData, stage_id: e.target.value })} className="input-base">
                  {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Contact</label>
              <select value={formData.contact_id} onChange={(e) => setFormData({ ...formData, contact_id: e.target.value })} className="input-base">
                <option value="">No contact linked</option>
                {contacts.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Description</label>
              <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows="2" className="input-base resize-none" placeholder="Deal details..." />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Expected Close</label>
                <input type="date" value={formData.expected_close_date} onChange={(e) => setFormData({ ...formData, expected_close_date: e.target.value })} className="input-base" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Status</label>
                <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="input-base">
                  <option value="open">Active</option><option value="won">Won</option><option value="lost">Lost</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center py-2.5 disabled:opacity-50">
                {saving ? 'Saving...' : (editingDeal ? 'Update Deal' : 'Create Deal')}
              </button>
              <button type="button" onClick={() => { setShowDealModal(false); setEditingDeal(null); }} className="btn-secondary flex-1 justify-center py-2.5">Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {activeMenu && <div className="fixed inset-0 z-0" onClick={() => setActiveMenu(null)} />}
    </div>
  );
}
