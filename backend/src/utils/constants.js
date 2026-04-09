/**
 * Constantes y Enums del sistema
 */

const Central_ID = '062DCE3A-9F92-434C-9CC1-7FA5F457668B'; // <-- mismo GUID


const UserRoles = {
  ADMIN: 'admin',
  TECHNICIAN: 'technician',
  HOTEL_USER: 'hotel_user',
  CENTRAL_USER: 'central_user',
};

const TicketStatus = {
  NEW: 'new',
  ASSIGNED: 'assigned',
  IN_PROGRESS: 'in_progress',
  WAITING_RESPONSE: 'waiting_response',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
  CANCELLED: 'cancelled',
};

const TicketPriority = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

const SuggestionStatus = {
  NEW: 'new',
  IN_STUDY: 'in_study',
  IN_DEVELOPMENT: 'in_development',
  CANCELLED: 'cancelled',
  PUBLISHED: 'published',
};

const ProjectStatus = {
  IN_DEVELOPMENT: 'in_development',
  PUBLISHED: 'published',
  UPDATE_AVAILABLE: 'update_available',
  ARCHIVED: 'archived',
};

const NotificationType = {
  INFO: 'info',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error',
  MESSAGE: 'message',
  PROJECT_NEW: 'project_new',
  PROJECT_ASSIGNED: 'project_assigned',
  SUGGESTION_NEW: 'suggestion_new',
  SUGGESTION_APPROVED: 'suggestion_approved',
  SUGGESTION_SUSPENDED: 'suggestion_suspended',
  TICKET_AWATING: 'ticket_awaiting',
  TICKET_NEW: 'ticket_new', //Nuevo Ticket
  TICKET_ASSIGNED: 'ticket_assigned',//Ticket asignado
  TICKET_RESOLVED: 'ticket_resolved',
};

module.exports = {
  UserRoles,
  TicketStatus,
  TicketPriority,
  SuggestionStatus,
  ProjectStatus,
  NotificationType,
  Central_ID,
};
