import { formatDistanceToNow, format, isToday, isPast, isThisWeek, parseISO } from 'date-fns';

const AVATAR_COLORS = ['#8b5cf6', '#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

export function getColorFromHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function getInitials(firstName, lastName) {
  return `${(firstName || '').charAt(0)}${(lastName || '').charAt(0)}`.toUpperCase();
}

export function getPriorityColor(priority) {
  const p = (priority || '').toLowerCase();
  if (p === 'urgent') return 'badge-urgent';
  if (p === 'high') return 'badge-high';
  if (p === 'medium') return 'badge-medium';
  return 'badge-low';
}

export function getStatusBadgeColor(status) {
  const s = (status || '').toLowerCase();
  if (s === 'lead') return 'badge-lead';
  if (s === 'active') return 'badge-active';
  if (s === 'client') return 'badge-client';
  return 'badge-inactive';
}

export function getDueDateInfo(dueDate) {
  if (!dueDate) return { text: 'No date', color: 'text-text-subtle' };
  const date = parseISO(dueDate);
  if (isPast(date) && !isToday(date)) return { text: `Overdue: ${format(date, 'MMM d')}`, color: 'text-red-600' };
  if (isToday(date)) return { text: 'Today', color: 'text-amber-600' };
  return { text: format(date, 'MMM d'), color: 'text-text-muted' };
}

export function formatRelativeDate(date) {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function getContactFullName(contact) {
  return `${contact.first_name || ''} ${contact.last_name || ''}`.trim();
}

export function findContactName(contacts, contactId) {
  const contact = contacts.find(c => c.id === contactId);
  if (!contact) return null;
  return getContactFullName(contact);
}

export function findDealTitle(deals, dealId) {
  const deal = deals.find(d => d.id === dealId);
  return deal?.title || null;
}

export function formatCurrency(value) {
  if (!value && value !== 0) return '£0';
  return `£${Number(value).toLocaleString()}`;
}

const TASK_TYPES = [
  { value: 'follow_up', label: 'Follow Up', color: 'badge-type-followup', icon: '📞' },
  { value: 'shoot', label: 'Shoot', color: 'badge-type-shoot', icon: '📸' },
  { value: 'edit', label: 'Edit', color: 'badge-type-edit', icon: '✏️' },
  { value: 'delivery', label: 'Delivery', color: 'badge-type-delivery', icon: '📦' },
  { value: 'admin', label: 'Admin', color: 'badge-type-admin', icon: '📋' },
  { value: 'other', label: 'Other', color: 'badge-type-other', icon: '📌' },
];

export { TASK_TYPES };

export function getTaskTypeInfo(type) {
  return TASK_TYPES.find(t => t.value === type) || TASK_TYPES[TASK_TYPES.length - 1];
}

export function getTaskTypeColor(type) {
  return getTaskTypeInfo(type).color;
}

export function getStaleContacts(contacts, notes, interactions, tasks, daysThreshold = 14) {
  const now = new Date();
  return contacts
    .map(contact => {
      const contactNotes = notes.filter(n => n.contact_id === contact.id);
      const contactInteractions = interactions.filter(i => i.contact_id === contact.id);
      const contactTasks = tasks.filter(t => t.contact_id === contact.id && t.status === 'completed');

      const allDates = [
        ...contactNotes.map(n => new Date(n.created_at)),
        ...contactInteractions.map(i => new Date(i.created_at)),
        ...contactTasks.map(t => new Date(t.completed_at || t.created_at)),
      ];

      const lastActivity = allDates.length > 0
        ? new Date(Math.max(...allDates.map(d => d.getTime())))
        : new Date(contact.created_at);

      const daysSince = Math.floor((now - lastActivity) / (1000 * 60 * 60 * 24));

      return { ...contact, lastActivity, daysSince };
    })
    .filter(c => c.daysSince >= daysThreshold && c.status !== 'inactive')
    .sort((a, b) => b.daysSince - a.daysSince);
}

export function getDealsClosingThisWeek(deals) {
  const now = new Date();
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  return deals.filter(d => {
    if (!d.expected_close_date) return false;
    if (d.status === 'won' || d.status === 'lost') return false;
    const closeDate = parseISO(d.expected_close_date);
    return closeDate >= now && closeDate <= weekFromNow;
  });
}

export function getTaskStats(tasks) {
  return {
    overdue: tasks.filter(t => {
      if (t.status === 'Completed' || t.status === 'Cancelled') return false;
      return t.due_date && isPast(parseISO(t.due_date)) && !isToday(parseISO(t.due_date));
    }).length,
    today: tasks.filter(t => {
      if (t.status === 'Completed' || t.status === 'Cancelled') return false;
      return t.due_date && isToday(parseISO(t.due_date));
    }).length,
    pending: tasks.filter(t => t.status === 'Pending').length,
    inProgress: tasks.filter(t => t.status === 'In Progress').length,
    completedThisWeek: tasks.filter(t => {
      return t.status === 'Completed' && t.completed_at && isThisWeek(parseISO(t.completed_at));
    }).length,
  };
}
