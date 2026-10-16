-- Upgrade an EXISTING jcalumpit_dental database from the first version (keeps all current data).
-- Adds: users.address / is_active / last_login / 'dentist' role, appointments.fee / billed_at,
--       and the payments, records and treatments tables.
-- Import this in phpMyAdmin INSTEAD of database.sql if you already have accounts or appointments.
USE jcalumpit_dental;

ALTER TABLE users
  ADD COLUMN address    VARCHAR(255) NOT NULL DEFAULT '' AFTER phone,
  ADD COLUMN is_active  TINYINT(1)   NOT NULL DEFAULT 1 AFTER role,
  ADD COLUMN last_login DATETIME     NULL AFTER is_active,
  MODIFY COLUMN role ENUM('patient','staff','dentist','admin') NOT NULL DEFAULT 'patient';

UPDATE users SET address = '2nd floor Banlicom Sentre 217 Maharlika Hwy, Banlic, Cabuyao, Philippines, 4025'
  WHERE role IN ('admin','staff') AND address = '';

ALTER TABLE appointments
  ADD COLUMN fee       DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER admin_note,
  ADD COLUMN billed_at DATETIME      NULL AFTER fee;

INSERT IGNORE INTO users (first_name, middle_name, last_name, gender, birth_date, email, phone, address, username, password_hash, role)
VALUES ('Jonathan', NULL, 'Calumpit', 'male', '1990-01-01', 'dentist@jcalumpit.local', '09120000003', '2nd floor Banlicom Sentre 217 Maharlika Hwy, Banlic, Cabuyao, Philippines, 4025', 'dentist', '$2y$12$AN2BewfnBsSpo9iaGtc02OX21st.sdyDgiZ1unWsL/DFUVYFKIrLG', 'dentist');
-- (new dentist login: dentist / Dentist@123 — change it after first login)


-- Payments recorded by staff against an appointment's fee
CREATE TABLE IF NOT EXISTS payments (
  id             INT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
  appointment_id INT UNSIGNED  NOT NULL,
  user_id        INT UNSIGNED  NOT NULL,
  amount         DECIMAL(10,2) NOT NULL,
  method         ENUM('cash','gcash','maya','card','bank_transfer','other') NOT NULL DEFAULT 'cash',
  reference      VARCHAR(100)  NULL,
  note           VARCHAR(255)  NULL,
  paid_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  recorded_by    INT UNSIGNED  NULL,
  KEY idx_pay_appt (appointment_id),
  KEY idx_pay_user (user_id),
  CONSTRAINT fk_pay_appt FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
  CONSTRAINT fk_pay_user FOREIGN KEY (user_id)        REFERENCES users(id)        ON DELETE CASCADE,
  CONSTRAINT fk_pay_by   FOREIGN KEY (recorded_by)    REFERENCES users(id)        ON DELETE SET NULL
) ENGINE=InnoDB;

-- Patient records (medical history, prescriptions, x-rays, lab results, documents)
CREATE TABLE IF NOT EXISTS records (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  patient_id  INT UNSIGNED NOT NULL,
  record_type ENUM('medical_history','prescription','xray','lab_result','document') NOT NULL,
  title       VARCHAR(150) NOT NULL,
  details     TEXT         NULL,
  file_name   VARCHAR(255) NULL,           -- original file name
  file_path   VARCHAR(100) NULL,           -- stored name inside /storage/records
  file_mime   VARCHAR(100) NULL,
  record_date DATE         NOT NULL,
  added_by    INT UNSIGNED NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_rec_patient (patient_id),
  KEY idx_rec_type (record_type),
  CONSTRAINT fk_rec_patient FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_rec_by      FOREIGN KEY (added_by)   REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Treatments and treatment plans
CREATE TABLE IF NOT EXISTS treatments (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  patient_id     INT UNSIGNED NOT NULL,
  name           VARCHAR(150) NOT NULL,
  dentist        VARCHAR(100) NOT NULL DEFAULT 'Dr. Calumpit',
  start_date     DATE         NOT NULL,
  status         ENUM('plan','ongoing','completed','cancelled') NOT NULL DEFAULT 'ongoing',
  completed_on   DATE         NULL,
  notes          TEXT         NULL,
  created_by     INT UNSIGNED NULL,
  created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_tr_patient (patient_id),
  KEY idx_tr_status (status),
  CONSTRAINT fk_tr_patient FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_tr_by      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;
