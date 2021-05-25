UPDATE auth_users SET password = $1
    WHERE id = $2 AND password = $3
    RETURNING *