UPDATE auth_devices
    SET user_id = (SELECT id FROM auth_users WHERE (username = $1 OR email = $1) AND password = $2)
    WHERE device_id = $3
RETURNING *;