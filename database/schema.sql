-- =============================================
-- SOHO Systems Core - SQL Server Database Schema
-- Version: 1.0.0
-- Description: Script de creación de base de datos para SQL Server
-- =============================================

-- Crear base de datos (ejecutar como admin)
 CREATE DATABASE SOHOSystemsCore;
 GO
 USE SOHOSystemsCore;
 GO

-- =============================================
-- TABLA: roles
-- Roles personalizados adicionales del sistema
-- =============================================
CREATE TABLE roles (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(100) NOT NULL UNIQUE,
    description NVARCHAR(500) NULL,
    permissions NVARCHAR(MAX) NULL, -- JSON array de permisos
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE()
);

-- =============================================
-- TABLA: departments
-- Departamentos de la empresa
-- =============================================
CREATE TABLE departments (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(100) NOT NULL UNIQUE,
    description NVARCHAR(500) NULL,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE()
);

-- =============================================
-- TABLA: hotels
-- Hoteles de la cadena
-- =============================================
CREATE TABLE hotels (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(200) NOT NULL,
    code NVARCHAR(20) NOT NULL UNIQUE,
    address NVARCHAR(500) NULL,
    is_active BIT DEFAULT 1,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE()
);

-- =============================================
-- TABLA: users
-- Usuarios del sistema
-- =============================================
CREATE TABLE users (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    email NVARCHAR(255) NOT NULL UNIQUE,
    password_hash NVARCHAR(255) NOT NULL,
    name NVARCHAR(200) NOT NULL,
    role NVARCHAR(50) NOT NULL DEFAULT 'central_user', -- admin, technician, hotel_user, central_user
    department_id UNIQUEIDENTIFIER NULL,
    can_create_suggestions BIT DEFAULT 0,
    can_access_tickets BIT DEFAULT 1,
    is_active BIT DEFAULT 1,
    microsoft_id NVARCHAR(255) NULL, -- Para OAuth Microsoft
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE(),
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
    CONSTRAINT CHK_user_role CHECK (role IN ('admin', 'technician', 'hotel_user', 'central_user'))
);

-- =============================================
-- TABLA: user_hotels
-- Relación muchos a muchos entre usuarios y hoteles
-- =============================================
CREATE TABLE user_hotels (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    user_id UNIQUEIDENTIFIER NOT NULL,
    hotel_id UNIQUEIDENTIFIER NOT NULL,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE,
    CONSTRAINT UQ_user_hotel UNIQUE (user_id, hotel_id)
);

-- =============================================
-- TABLA: ticket_types
-- Tipos de tickets
-- =============================================
CREATE TABLE ticket_types (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(100) NOT NULL UNIQUE,
    description NVARCHAR(500) NULL,
    default_priority NVARCHAR(20) DEFAULT 'medium',
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE(),
    CONSTRAINT CHK_ticket_type_priority CHECK (default_priority IN ('low', 'medium', 'high', 'critical'))
);

-- =============================================
-- TABLA: tickets
-- Tickets de incidencias
-- =============================================
CREATE TABLE tickets (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    title NVARCHAR(300) NOT NULL,
    description NVARCHAR(MAX) NOT NULL,
    ticket_type_id UNIQUEIDENTIFIER NOT NULL,
    priority NVARCHAR(20) DEFAULT 'medium',
    status NVARCHAR(30) DEFAULT 'new',
    hotel_id UNIQUEIDENTIFIER NOT NULL,
    created_by UNIQUEIDENTIFIER NOT NULL,
    assigned_to UNIQUEIDENTIFIER NULL,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE(),
    resolved_at DATETIME2 NULL,
    closed_at DATETIME2 NULL,
    FOREIGN KEY (ticket_type_id) REFERENCES ticket_types(id),
    FOREIGN KEY (hotel_id) REFERENCES hotels(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (assigned_to) REFERENCES users(id),
    CONSTRAINT CHK_ticket_priority CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    CONSTRAINT CHK_ticket_status CHECK (status IN ('new', 'assigned', 'in_progress', 'waiting_response', 'resolved', 'closed'))
);

-- =============================================
-- TABLA: ticket_comments
-- Comentarios de tickets
-- =============================================
CREATE TABLE ticket_comments (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    ticket_id UNIQUEIDENTIFIER NOT NULL,
    user_id UNIQUEIDENTIFIER NOT NULL,
    content NVARCHAR(MAX) NOT NULL,
    is_internal BIT DEFAULT 0,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- =============================================
-- TABLA: suggestions
-- Propuestas de mejora/proyectos
-- =============================================
CREATE TABLE suggestions (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    title NVARCHAR(300) NOT NULL,
    description NVARCHAR(MAX) NOT NULL,
    benefits NVARCHAR(MAX) NULL,
    status NVARCHAR(30) DEFAULT 'new',
    created_by UNIQUEIDENTIFIER NOT NULL,
    assigned_to UNIQUEIDENTIFIER NULL,
    project_id UNIQUEIDENTIFIER NULL,
    cancellation_reason NVARCHAR(MAX) NULL,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE(),
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (assigned_to) REFERENCES users(id),
    CONSTRAINT CHK_suggestion_status CHECK (status IN ('new', 'in_study', 'in_development', 'cancelled', 'published'))
);

-- =============================================
-- TABLA: projects
-- Proyectos del departamento de sistemas
-- =============================================
CREATE TABLE projects (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(200) NOT NULL,
    description NVARCHAR(MAX) NOT NULL,
    version NVARCHAR(50) DEFAULT '1.0.0',
    status NVARCHAR(30) DEFAULT 'in_development',
    created_by UNIQUEIDENTIFIER NOT NULL,
    suggestion_id UNIQUEIDENTIFIER NULL,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE(),
    published_at DATETIME2 NULL,
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (suggestion_id) REFERENCES suggestions(id) ON DELETE SET NULL,
    CONSTRAINT CHK_project_status CHECK (status IN ('in_development', 'published', 'update_available', 'archived'))
);

-- Agregar FK de suggestions a projects (referencia circular)
ALTER TABLE suggestions ADD CONSTRAINT FK_suggestion_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;

-- =============================================
-- TABLA: project_departments
-- Departamentos asignados a proyectos
-- =============================================
CREATE TABLE project_departments (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    project_id UNIQUEIDENTIFIER NOT NULL,
    department_id UNIQUEIDENTIFIER NOT NULL,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
    CONSTRAINT UQ_project_department UNIQUE (project_id, department_id)
);

-- =============================================
-- TABLA: project_users
-- Usuarios asignados a proyectos
-- =============================================
CREATE TABLE project_users (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    project_id UNIQUEIDENTIFIER NOT NULL,
    user_id UNIQUEIDENTIFIER NOT NULL,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT UQ_project_user UNIQUE (project_id, user_id)
);

-- =============================================
-- TABLA: notifications
-- Notificaciones del sistema
-- =============================================
CREATE TABLE notifications (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    user_id UNIQUEIDENTIFIER NOT NULL,
    title NVARCHAR(200) NOT NULL,
    message NVARCHAR(MAX) NOT NULL,
    type NVARCHAR(50) DEFAULT 'info', -- info, success, warning, error
    link NVARCHAR(500) NULL,
    is_read BIT DEFAULT 0,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =============================================
-- ÍNDICES
-- =============================================

-- Índices para usuarios
CREATE INDEX IX_users_email ON users(email);
CREATE INDEX IX_users_role ON users(role);
CREATE INDEX IX_users_department ON users(department_id);

-- Índices para tickets
CREATE INDEX IX_tickets_status ON tickets(status);
CREATE INDEX IX_tickets_priority ON tickets(priority);
CREATE INDEX IX_tickets_hotel ON tickets(hotel_id);
CREATE INDEX IX_tickets_created_by ON tickets(created_by);
CREATE INDEX IX_tickets_assigned_to ON tickets(assigned_to);
CREATE INDEX IX_tickets_created_at ON tickets(created_at DESC);

-- Índices para Propuestas
CREATE INDEX IX_suggestions_status ON suggestions(status);
CREATE INDEX IX_suggestions_created_by ON suggestions(created_by);
CREATE INDEX IX_suggestions_created_at ON suggestions(created_at DESC);

-- Índices para proyectos
CREATE INDEX IX_projects_status ON projects(status);
CREATE INDEX IX_projects_created_by ON projects(created_by);

-- Índices para notificaciones
CREATE INDEX IX_notifications_user ON notifications(user_id);
CREATE INDEX IX_notifications_read ON notifications(is_read);
CREATE INDEX IX_notifications_created_at ON notifications(created_at DESC);

-- Índices para hoteles
CREATE INDEX IX_hotels_code ON hotels(code);
CREATE INDEX IX_hotels_active ON hotels(is_active);

-- =============================================
-- DATOS INICIALES
-- =============================================

-- Insertar departamentos iniciales
INSERT INTO departments (name, description) VALUES 
('Sistemas', 'Departamento de Tecnología e Informática'),
('Recepción', 'Atención al cliente y check-in/check-out'),
('Dirección', 'Dirección General y Administración'),
('Mantenimiento', 'Mantenimiento de instalaciones'),
('Housekeeping', 'Limpieza y gestión de habitaciones');

-- Insertar hoteles de ejemplo
INSERT INTO hotels (name, code, address) VALUES 
('SOHO Hotel Madrid Centro', 'MAD01', 'Calle Gran Vía, 1 - Madrid'),
('SOHO Hotel Barcelona', 'BCN01', 'Paseo de Gracia, 100 - Barcelona'),
('SOHO Hotel Valencia', 'VLC01', 'Calle Colón, 50 - Valencia'),
('SOHO Hotel Sevilla', 'SVQ01', 'Avenida de la Constitución, 20 - Sevilla'),
('SOHO Hotel Málaga', 'AGP01', 'Calle Larios, 10 - Málaga');

-- Insertar tipos de ticket
INSERT INTO ticket_types (name, description, default_priority) VALUES 
('Hardware', 'Problemas con equipos informáticos (ordenadores, impresoras, etc.)', 'medium'),
('Software', 'Problemas con aplicaciones y programas', 'medium'),
('Red', 'Problemas de conectividad y acceso a Internet', 'high'),
('Impresora', 'Problemas específicos de impresión', 'low'),
('Accesos', 'Problemas de acceso a sistemas y permisos', 'medium'),
('PMS', 'Problemas con el sistema de gestión hotelera', 'critical'),
('Email', 'Problemas con correo electrónico', 'medium'),
('Telefonía', 'Problemas con sistema telefónico', 'medium');

-- Insertar usuario administrador por defecto
-- NOTA: La contraseña debe ser hasheada en la aplicación. 
-- Esto es solo un placeholder - usar la API /seed para crear usuarios reales
-- INSERT INTO users (email, password_hash, name, role, can_create_suggestions, can_access_tickets)
-- VALUES ('admin@sohohoteles.com', 'HASH_AQUI', 'Administrador Sistema', 'admin', 1, 1);

-- =============================================
-- VISTAS ÚTILES
-- =============================================

-- Vista de tickets con información relacionada
CREATE VIEW vw_tickets_full AS
SELECT 
    t.id,
    t.title,
    t.description,
    t.priority,
    t.status,
    t.created_at,
    t.updated_at,
    t.resolved_at,
    t.closed_at,
    tt.name AS ticket_type_name,
    h.name AS hotel_name,
    h.code AS hotel_code,
    uc.name AS created_by_name,
    ua.name AS assigned_to_name
FROM tickets t
INNER JOIN ticket_types tt ON t.ticket_type_id = tt.id
INNER JOIN hotels h ON t.hotel_id = h.id
INNER JOIN users uc ON t.created_by = uc.id
LEFT JOIN users ua ON t.assigned_to = ua.id;

-- Vista de Propuestas con información relacionada
CREATE VIEW vw_suggestions_full AS
SELECT 
    s.id,
    s.title,
    s.description,
    s.benefits,
    s.status,
    s.cancellation_reason,
    s.created_at,
    s.updated_at,
    uc.name AS created_by_name,
    ua.name AS assigned_to_name,
    p.name AS project_name,
    p.version AS project_version
FROM suggestions s
INNER JOIN users uc ON s.created_by = uc.id
LEFT JOIN users ua ON s.assigned_to = ua.id
LEFT JOIN projects p ON s.project_id = p.id;

-- Vista de estadísticas de tickets por técnico
CREATE VIEW vw_tickets_by_technician AS
SELECT 
    u.id AS technician_id,
    u.name AS technician_name,
    COUNT(t.id) AS total_tickets,
    SUM(CASE WHEN t.status = 'new' THEN 1 ELSE 0 END) AS new_tickets,
    SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress_tickets,
    SUM(CASE WHEN t.status = 'resolved' THEN 1 ELSE 0 END) AS resolved_tickets
FROM users u
LEFT JOIN tickets t ON u.id = t.assigned_to
WHERE u.role IN ('admin', 'technician')
GROUP BY u.id, u.name;

-- =============================================
-- PROCEDIMIENTOS ALMACENADOS
-- =============================================

-- Procedimiento para obtener estadísticas del dashboard
GO
CREATE PROCEDURE sp_get_dashboard_stats
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Tickets
    SELECT 
        COUNT(*) AS total_tickets,
        SUM(CASE WHEN status NOT IN ('closed') THEN 1 ELSE 0 END) AS open_tickets,
        SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) AS resolved_tickets,
        SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) AS closed_tickets,
        SUM(CASE WHEN priority = 'critical' AND status NOT IN ('resolved', 'closed') THEN 1 ELSE 0 END) AS critical_tickets,
        SUM(CASE WHEN priority = 'high' AND status NOT IN ('resolved', 'closed') THEN 1 ELSE 0 END) AS high_tickets
    FROM tickets;
    
    -- Propuestas
    SELECT 
        COUNT(*) AS total_suggestions,
        SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) AS new_suggestions,
        SUM(CASE WHEN status = 'in_study' THEN 1 ELSE 0 END) AS in_study_suggestions,
        SUM(CASE WHEN status = 'in_development' THEN 1 ELSE 0 END) AS in_development_suggestions
    FROM suggestions;
    
    -- Proyectos
    SELECT 
        COUNT(*) AS total_projects,
        SUM(CASE WHEN status IN ('in_development', 'published', 'update_available') THEN 1 ELSE 0 END) AS active_projects
    FROM projects;
END;
GO

-- =============================================
-- TRIGGERS
-- =============================================

-- Trigger para actualizar updated_at en tickets
CREATE TRIGGER tr_tickets_updated_at
ON tickets
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE tickets
    SET updated_at = GETUTCDATE()
    FROM tickets t
    INNER JOIN inserted i ON t.id = i.id;
END;
GO

-- Trigger para actualizar updated_at en suggestions
CREATE TRIGGER tr_suggestions_updated_at
ON suggestions
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE suggestions
    SET updated_at = GETUTCDATE()
    FROM suggestions s
    INNER JOIN inserted i ON s.id = i.id;
END;
GO

-- Trigger para actualizar updated_at en projects
CREATE TRIGGER tr_projects_updated_at
ON projects
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE projects
    SET updated_at = GETUTCDATE()
    FROM projects p
    INNER JOIN inserted i ON p.id = i.id;
END;
GO

PRINT 'Schema de base de datos creado exitosamente.';
PRINT 'Recuerde crear el usuario administrador usando la API /seed o insertando manualmente con contraseña hasheada.';
GO
