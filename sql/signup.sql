INSERT INTO auth_users (username, password, email, isAdmin, last_login)
VALUES
    ($1, $2, $3, $4, (SELECT CURRENT_TIMESTAMP))
RETURNING id;

INSERT INTO auth_devices (device_id, user_id)
VALUES
    ($1, null);

UPDATE auth_devices SET user_id = $1
WHERE device_id = $2;