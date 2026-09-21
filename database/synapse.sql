-- ============================================================================
--  SYNAPSE - Sistema de Gestión de Recursos Organizacionales
--  Esquema de base de datos (MySQL 8.0+)
--  Archivo: database/synapse.sql
-- ============================================================================

CREATE DATABASE IF NOT EXISTS synapse
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE synapse;

-- ----------------------------------------------------------------------------
-- Tabla: users
-- Usuarios del sistema con rol de acceso (admin / user).
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS maintenance_logs;
DROP TABLE IF EXISTS reservations;
DROP TABLE IF EXISTS assets;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id            INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  nombre        VARCHAR(100)     NOT NULL,
  email         VARCHAR(190)     NOT NULL,
  password_hash VARCHAR(255)     NOT NULL,
  role          ENUM('admin','user') NOT NULL DEFAULT 'user',
  created_at    TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Tabla: assets
-- Inventario de recursos (materiales, tecnológicos, etc.).
-- estado: disponible | en_uso | mantenimiento
-- ----------------------------------------------------------------------------
CREATE TABLE assets (
  id             INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  nombre         VARCHAR(100)      NOT NULL,
  tipo           VARCHAR(50)       NOT NULL,
  estado         ENUM('disponible','en_uso','mantenimiento') NOT NULL DEFAULT 'disponible',
  ubicacion      VARCHAR(100)      NOT NULL DEFAULT '',
  responsable_id INT UNSIGNED      NULL,
  created_at     TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_assets_tipo (tipo),
  KEY idx_assets_estado (estado),
  KEY idx_assets_responsable (responsable_id),
  CONSTRAINT fk_assets_responsable FOREIGN KEY (responsable_id)
    REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Tabla: reservations
-- Reservas de recursos compartidos con estado de aprobación.
-- ----------------------------------------------------------------------------
CREATE TABLE reservations (
  id                INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  asset_id          INT UNSIGNED  NOT NULL,
  user_id           INT UNSIGNED  NOT NULL,
  fecha_inicio      DATETIME      NOT NULL,
  fecha_fin         DATETIME      NOT NULL,
  estado_aprobacion ENUM('pendiente','aprobada','rechazada','cancelada') NOT NULL DEFAULT 'pendiente',
  created_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_res_asset (asset_id),
  KEY idx_res_user (user_id),
  KEY idx_res_fecha_inicio (fecha_inicio),
  KEY idx_res_fecha_fin (fecha_fin),
  KEY idx_res_estado (estado_aprobacion),
  CONSTRAINT fk_res_asset FOREIGN KEY (asset_id)
    REFERENCES assets (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_res_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT chk_res_fechas CHECK (fecha_fin > fecha_inicio)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Tabla: maintenance_logs
-- Historial de mantenimiento y reparaciones de los activos.
-- estado_reparacion: reportado | en_proceso | completado
-- ----------------------------------------------------------------------------
CREATE TABLE maintenance_logs (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  asset_id          INT UNSIGNED NOT NULL,
  descripcion       TEXT         NOT NULL,
  fecha_reporte     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  estado_reparacion ENUM('reportado','en_proceso','completado') NOT NULL DEFAULT 'reportado',
  created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_maint_asset (asset_id),
  KEY idx_maint_estado (estado_reparacion),
  KEY idx_maint_fecha (fecha_reporte),
  CONSTRAINT fk_maint_asset FOREIGN KEY (asset_id)
    REFERENCES assets (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;