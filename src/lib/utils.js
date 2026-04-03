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
