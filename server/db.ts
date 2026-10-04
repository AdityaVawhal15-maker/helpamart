import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'

const dataDir = path.resolve(process.cwd(), 'data')
const uploadDir = path.join(dataDir, 'uploads')
fs.mkdirSync(uploadDir, { recursive: true })

export const db = new DatabaseSync(path.join(dataDir, 'helpa.sqlite'))
db.exec('PRAGMA journal_mode = WAL')
db.exec('PRAGMA foreign_keys = ON')

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  password_hash TEXT,
  google_id TEXT UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  photo_url TEXT,
  bio TEXT,
  location TEXT,
  timezone TEXT DEFAULT 'UTC',
  languages TEXT DEFAULT '[]',
  interests TEXT DEFAULT '[]',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS otp_codes (
  id TEXT PRIMARY KEY,
  destination TEXT NOT NULL,
  channel TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS mentor_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  role_title TEXT NOT NULL DEFAULT '',
  company TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  intro TEXT NOT NULL DEFAULT '',
  about TEXT NOT NULL DEFAULT '',
  photo_url TEXT,
  languages TEXT DEFAULT '[]',
  years_experience INTEGER,
  linkedin_url TEXT,
  website_url TEXT,
  education TEXT DEFAULT '[]',
  companies TEXT DEFAULT '[]',
  achievements TEXT DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft',
  timezone TEXT DEFAULT 'UTC',
  buffer_minutes INTEGER DEFAULT 15,
  advance_days INTEGER DEFAULT 30,
  min_notice_hours INTEGER DEFAULT 24,
  max_bookings_per_day INTEGER DEFAULT 4,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS mentor_expertise (
  id TEXT PRIMARY KEY,
  mentor_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  value TEXT NOT NULL,
  FOREIGN KEY (mentor_id) REFERENCES mentor_profiles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS mentor_services (
  id TEXT PRIMARY KEY,
  mentor_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  duration_minutes INTEGER NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  format TEXT NOT NULL DEFAULT 'online',
  active INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (mentor_id) REFERENCES mentor_profiles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS availability_rules (
  id TEXT PRIMARY KEY,
  mentor_id TEXT NOT NULL,
  weekday INTEGER NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (mentor_id) REFERENCES mentor_profiles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS availability_exceptions (
  id TEXT PRIMARY KEY,
  mentor_id TEXT NOT NULL,
  date TEXT NOT NULL,
  kind TEXT NOT NULL,
  start_time TEXT,
  end_time TEXT,
  FOREIGN KEY (mentor_id) REFERENCES mentor_profiles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS calendar_connections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL DEFAULT 'google',
  access_token TEXT,
  refresh_token TEXT,
  expiry TEXT,
  account_email TEXT,
  calendar_id TEXT DEFAULT 'primary',
  status TEXT NOT NULL DEFAULT 'disconnected',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  mentor_id TEXT NOT NULL,
  mentee_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  mentor_email TEXT,
  student_email TEXT,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  timezone TEXT NOT NULL,
  status TEXT NOT NULL,
  payment_status TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  meet_link TEXT,
  calendar_event_id TEXT,
  calendar_status TEXT,
  notes TEXT,
  stripe_session_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  FOREIGN KEY (mentor_id) REFERENCES mentor_profiles(id),
  FOREIGN KEY (mentee_id) REFERENCES users(id),
  FOREIGN KEY (service_id) REFERENCES mentor_services(id)
);

try { db.exec('ALTER TABLE bookings ADD COLUMN mentor_email TEXT'); } catch {}
try { db.exec('ALTER TABLE bookings ADD COLUMN student_email TEXT'); } catch {}
try { db.exec('ALTER TABLE bookings ADD COLUMN updated_at TEXT'); } catch {}

CREATE TABLE IF NOT EXISTS saved_mentors (
  user_id TEXT NOT NULL,
  mentor_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, mentor_id)
);

CREATE TABLE IF NOT EXISTS community_posts (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (author_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS community_replies (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (post_id) REFERENCES community_posts(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS community_follows (
  user_id TEXT NOT NULL,
  post_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, post_id)
);

CREATE TABLE IF NOT EXISTS community_likes (
  user_id TEXT NOT NULL,
  post_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, post_id),
  FOREIGN KEY (post_id) REFERENCES community_posts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS stories (
  id TEXT PRIMARY KEY,
  author_name TEXT NOT NULL,
  author_role TEXT,
  quote TEXT NOT NULL,
  body TEXT,
  mentor_name TEXT,
  category TEXT,
  photo_url TEXT,
  published INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS platform_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bookings_mentor_time ON bookings(mentor_id, start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_mentors_status ON mentor_profiles(status);
CREATE INDEX IF NOT EXISTS idx_posts_category ON community_posts(category);
`)

const fee = db.prepare('SELECT value FROM platform_settings WHERE key = ?').get('platform_fee_percent')
if (!fee) {
  db.prepare('INSERT INTO platform_settings (key, value) VALUES (?, ?)').run('platform_fee_percent', '10')
}

export function nowIso() {
  return new Date().toISOString()
}

export const uploadDirPath = uploadDir
