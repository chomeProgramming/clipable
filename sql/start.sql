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

-- channel_id (foreign key)