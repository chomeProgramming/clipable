SELECT user_id, device_id, username, email, isAdmin, last_login, timezone as uploads_count
    FROM auth_devices
        JOIN auth_users ON auth_devices.user_id = auth_users.id
    WHERE device_id = $1