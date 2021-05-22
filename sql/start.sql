CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE TABLE IF NOT EXISTS videos (
    id UUID DEFAULT uuid_generate_v4 () PRIMARY KEY,
    mimetype TEXT NOT NULL,
    caption TEXT NOT NULL,
    video BYTEA NOT NULL,
    uploadtype TEXT NOT NULL DEFAULT 'video'
);

-- channel_id (foreign key)