INSERT INTO auth_users (username, password, email, isAdmin, last_login)
VALUES
    ($1, $2, $3, $4, (SELECT CURRENT_TIMESTAMP))
RETURNING id;
|
INSERT INTO auth_devices (user_id)
VALUES
    (null)
RETURNING *;
|
UPDATE auth_devices SET user_id = $1
WHERE device_id = $2;