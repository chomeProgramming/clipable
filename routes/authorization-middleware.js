const jwt = require("jsonwebtoken")

module.exports = (credentials = []) => {
    return (req, res, next) => {
        console.log("Authorization middleware")
        if (typeof credentials == "string")
            credentials = [credentials]

        const token = req.headers["authorization"]
        if (!token) {
            return res.status(401).send("Access denied")
        } else {
            jwt.verify(token, require("../config").JWT_SECRET, (err, decoded) => {
                if (err) {
                    console.log("JWT Error: "+err)
                    return res.status(401).send("Access denied")
                }

                if (credentials.length > 0) {
                    if (decoded.scopes
                        && decoded.scopes.length
                        && credentials.some(cred => decoded.scopes.indexOf(cred) >= 0))
                    {
                        if (decoded.scopes.authUser && decoded.scopes.authUser.id == req.body.authUser.id)
                            next()
                        else
                            return res.status(401).send("Access denied")
                    } else {
                        return res.status(401).send("Access denied")
                    }
                } else {
                    next()
                }
            })
        }
    }
}