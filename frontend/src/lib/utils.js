import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Format date to Spanish locale
export function formatDate(date, options = {}) {
  const defaultOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...options,
  };
  return new Date(date).toLocaleDateString('es-ES', defaultOptions);
}

// Format datetime to Spanish locale
export function formatDateTime(date) {
  return new Date(date).toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Truncate text with ellipsis
export function truncate(str, length = 50) {
  if (!str) return '';
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

// Status labels in Spanish
export const statusLabels = {
  // Ticket status
  new: 'Nuevo',
  assigned: 'Asignado',
  in_progress: 'En proceso',
  waiting_response: 'Esperando respuesta',
  resolved: 'Resuelto',
  closed: 'Cerrado',
  // Suggestion status
  in_study: 'En estudio',
  in_development: 'En desarrollo',
  cancelled: 'Cancelado',
  published: 'Publicado',
  // Project status
  update_available: 'Actualización disponible',
  archived: 'Archivado',
};

// Priority labels in Spanish
export const priorityLabels = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  critical: 'Crítica',
};

// Role labels in Spanish
export const roleLabels = {
  admin: 'Administrador',
  technician: 'Técnico',
  hotel_user: 'Usuario Hotel',
  central_user: 'Usuario Central',
};
export const Central_ID = '062DCE3A-9F92-434C-9CC1-7FA5F457668B'; // <-- mismo GUID


// Get status label
export function getStatusLabel(status) {
  return statusLabels[status] || status;
}

// Get priority label
export function getPriorityLabel(priority) {
  return priorityLabels[priority] || priority;
}

// Get role label
export function getRoleLabel(role) {
  return roleLabels[role] || role;
}

export function getCookie(name) {
  return document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)')?.pop() || null;
}