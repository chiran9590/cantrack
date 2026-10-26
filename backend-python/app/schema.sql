-- CanTrack schema (MySQL 8+). Safe to re-run: every statement is idempotent.

-- ===== people =====
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(50)  NOT NULL CHECK (role IN ('admin','manager','breeder','gardener','member')),
  active        BOOLEAN      NOT NULL DEFAULT true,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP    NULL
);

-- ===== facility layout =====
CREATE TABLE IF NOT EXISTS glasshouses (
  code          VARCHAR(4) PRIMARY KEY CHECK (code REGEXP '^[A-Z0-9]{1,4}$'),
  name          VARCHAR(255) NOT NULL,
  num_platforms INT NOT NULL CHECK (num_platforms > 0),
  num_columns   INT NOT NULL CHECK (num_columns > 0),
  num_rows      INT NOT NULL CHECK (num_rows > 0),
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  description   VARCHAR(255) NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS platforms (
  glasshouse_code VARCHAR(4) NOT NULL,
  platform_no     INT NOT NULL,
  status          VARCHAR(50) NOT NULL DEFAULT 'active',
  PRIMARY KEY (glasshouse_code, platform_no),
  FOREIGN KEY (glasshouse_code) REFERENCES glasshouses(code)
);

CREATE TABLE IF NOT EXISTS positions (
  position_id     VARCHAR(50) PRIMARY KEY,               -- e.g. L1-P01-C03-R27
  glasshouse_code VARCHAR(4) NOT NULL,
  platform_no     INT NOT NULL,
  column_no       INT NOT NULL,
  row_no          INT NOT NULL,
  status          VARCHAR(50) NOT NULL DEFAULT 'active',
  UNIQUE KEY (glasshouse_code, platform_no, column_no, row_no),
  FOREIGN KEY (glasshouse_code) REFERENCES glasshouses(code)
);

CREATE INDEX positions_platform_idx ON positions (glasshouse_code, platform_no);

-- ===== genotypes and plants =====
CREATE TABLE IF NOT EXISTS genotypes (
  gid                  VARCHAR(50) PRIMARY KEY,
  phenomeone_id        VARCHAR(50),
  info                 JSON NOT NULL,
  status               VARCHAR(50) NOT NULL DEFAULT 'active',
  created_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  phenomeone_synced_at TIMESTAMP NULL
);

CREATE TABLE IF NOT EXISTS plants (
  uuid                CHAR(36) PRIMARY KEY,
  gid                 VARCHAR(50) NOT NULL,
  status              VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active','removed')),
  sown_date           DATE,
  current_position_id VARCHAR(50) UNIQUE,
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by          INT,
  FOREIGN KEY (gid) REFERENCES genotypes(gid),
  FOREIGN KEY (current_position_id) REFERENCES positions(position_id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  CHECK (status = 'active' OR current_position_id IS NULL)
);

CREATE INDEX plants_gid_idx ON plants (gid);

-- ===== scanning =====
CREATE TABLE IF NOT EXISTS scan_sessions (
  id           VARCHAR(50) PRIMARY KEY,                   -- e.g. S-20261009-A3F
  user_id      INT NOT NULL,
  source       VARCHAR(50) NOT NULL DEFAULT 'web',        -- web | mobile
  device       VARCHAR(255),
  started_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_scan_at TIMESTAMP NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS plant_location_history (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  plant_uuid  CHAR(36) NOT NULL,
  gid         VARCHAR(50) NOT NULL,
  position_id VARCHAR(50) NOT NULL,
  moved_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  recorded_by INT NOT NULL,
  source      VARCHAR(50) NOT NULL DEFAULT 'web',
  session_id  VARCHAR(50),
  kind        VARCHAR(50) NOT NULL DEFAULT 'scan' CHECK (kind IN ('scan','correction')),
  reason      VARCHAR(255),
  device      VARCHAR(255),
  FOREIGN KEY (plant_uuid) REFERENCES plants(uuid),
  FOREIGN KEY (position_id) REFERENCES positions(position_id),
  FOREIGN KEY (recorded_by) REFERENCES users(id),
  FOREIGN KEY (session_id) REFERENCES scan_sessions(id)
);

CREATE INDEX history_plant_idx   ON plant_location_history (plant_uuid, moved_at DESC);
CREATE INDEX history_time_idx    ON plant_location_history (moved_at DESC);
CREATE INDEX history_session_idx ON plant_location_history (session_id);

-- Rejected scans (invalid position, occupied position, ...). Powers the map's conflict cells.
CREATE TABLE IF NOT EXISTS scan_rejections (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT,
  position_id VARCHAR(50),
  plant_uuid  VARCHAR(50),
  reason      VARCHAR(255) NOT NULL,
  session_id  VARCHAR(50),
  source      VARCHAR(50),
  at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX rejections_pos_idx ON scan_rejections (position_id, at DESC);

-- Removing a plant never deletes history: it is recorded here and the plant is marked removed.
CREATE TABLE IF NOT EXISTS plant_status_history (
  id               BIGINT AUTO_INCREMENT PRIMARY KEY,
  plant_uuid       CHAR(36) NOT NULL,
  from_status      VARCHAR(50),
  to_status        VARCHAR(50) NOT NULL CHECK (to_status IN ('active','removed')),
  last_position_id VARCHAR(50),
  reason           VARCHAR(255) NOT NULL,
  at               TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  recorded_by      INT NOT NULL,
  FOREIGN KEY (plant_uuid) REFERENCES plants(uuid),
  FOREIGN KEY (last_position_id) REFERENCES positions(position_id),
  FOREIGN KEY (recorded_by) REFERENCES users(id)
);

CREATE INDEX status_hist_plant_idx ON plant_status_history (plant_uuid, at DESC);

-- ===== audit =====
CREATE TABLE IF NOT EXISTS audit_log (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  actor_id     INT,
  action       VARCHAR(255) NOT NULL,
  target       VARCHAR(255),
  before_value JSON,
  after_value  JSON,
  at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (actor_id) REFERENCES users(id)
);

CREATE INDEX audit_time_idx ON audit_log (at DESC);

-- ===== history and audit are append-only (the database itself refuses edits, not just the website) =====
-- MySQL triggers for read-only tables
DROP TRIGGER IF EXISTS lock_location_history_update;

CREATE TRIGGER lock_location_history_update BEFORE UPDATE ON plant_location_history
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Table plant_location_history is read-only: history records cannot be changed';
END;

DROP TRIGGER IF EXISTS lock_location_history_delete;

CREATE TRIGGER lock_location_history_delete BEFORE DELETE ON plant_location_history
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Table plant_location_history is read-only: history records cannot be deleted';
END;

DROP TRIGGER IF EXISTS lock_status_history_update;

CREATE TRIGGER lock_status_history_update BEFORE UPDATE ON plant_status_history
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Table plant_status_history is read-only: history records cannot be changed';
END;

DROP TRIGGER IF EXISTS lock_status_history_delete;

CREATE TRIGGER lock_status_history_delete BEFORE DELETE ON plant_status_history
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Table plant_status_history is read-only: history records cannot be deleted';
END;

DROP TRIGGER IF EXISTS lock_audit_log_update;

CREATE TRIGGER lock_audit_log_update BEFORE UPDATE ON audit_log
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Table audit_log is read-only: audit records cannot be changed';
END;

DROP TRIGGER IF EXISTS lock_audit_log_delete;

CREATE TRIGGER lock_audit_log_delete BEFORE DELETE ON audit_log
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Table audit_log is read-only: audit records cannot be deleted';
END;
