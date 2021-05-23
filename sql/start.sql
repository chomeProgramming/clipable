CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE TABLE IF NOT EXISTS videos (
    id UUID DEFAULT uuid_generate_v4 () PRIMARY KEY,
    mimetype TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    uploadtype TEXT NOT NULL DEFAULT 'video'
);
CREATE TABLE IF NOT EXISTS uploads (
    upload_id UUID PRIMARY KEY,
    uploaded BYTEA NOT NULL,
    FOREIGN KEY (upload_id)
        REFERENCES videos (id)
            ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS auth_users (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    email TEXT,
    password TEXT NOT NULL,
    isAdmin BOOLEAN DEFAULT FALSE,
    timezone TEXT,
    last_login DATE
);
CREATE TABLE IF NOT EXISTS auth_devices (
    device_id TEXT NOT NULL PRIMARY KEY,
    user_id INTEGER,
    FOREIGN KEY (user_id)
        REFERENCES auth_users (id)
            ON DELETE SET NULL
);

-- channel_id (foreign key)