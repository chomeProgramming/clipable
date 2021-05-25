const express = require("express")
const fs = require("fs")
const md5 = require("md5")
const { machineId, machineIdSync } = require("node-machine-id")
const { Pool, Client } = require("pg")

const router = express.Router()
const db = new Pool({
    connectionString: require("../client").connectionString,
    ssl: {
        rejectUnauthorized: false
    }
})
const getAuthUserSQL = fs.readFileSync("./sql/getAuthUser.sql").toString()
const signupSQL = fs.readFileSync("./sql/signup.sql").toString().split(";")
const loginSQL = fs.readFileSync("./sql/login.sql").toString()

let DEVICE_ID
machineId().then(id => {
    DEVICE_ID = id
})
let errMessage = ""
let inputData = {}
let successMessage = ""
const outputError = (req, error) => {
    errMessage = "*" + error
    inputData = req.body
}
const displayNotFound = res => {
    res.sendFile(path.join(__dirname, "./views/not_found.html"))
}
const forbiddenLoggedOut = ["/logout", "/create", "/profile"]
const forbiddenLoggedIn = ["/login", "/signup"]

router.get("/login", (req, res) => {
    res.render("login", {
        layout: "user",
        title: "Login",
        errMessage: errMessage,
        inputData: inputData,
        csrfToken: req.csrfToken
    })
    errMessage = ""
    inputData = {}
})

router.get("/signup", (req, res) => {
    res.render("signup", {
        layout: "user",
        title: "Sign Up",
        errMessage: errMessage,
        inputData: inputData,
        csrfToken: req.csrfToken
    })
    errMessage = ""
    inputData = {}
})

router.get("/logout", (req, res) => {
    db.query("UPDATE auth_devices SET user_id = null WHERE device_id = $1", [DEVICE_ID], (err) => {
        if (err)
            console.log(err.message)
        res.redirect("/logout")
    })
})

router.post("/login", (req, res) => {
    if (!req.body.username_email || !req.body.password) {
        outputError(req, "Something is missing.")
        return res.redirect("/login")
    }
    db.query(loginSQL, [req.body.username_email, md5(req.body.password), DEVICE_ID], (err, result) => {
        if (err)
            console.log(err.message)
        if (result.rowCount == 0 || !result.rows[0].user_id)
            outputError(req, "Wrong username, email or password.")

        db.query("UPDATE auth_users SET last_login = (SELECT CURRENT_TIMESTAMP) WHERE id = $1", [result.rows[0].user_id], (err) => {
            if (err)
                console.log(err)
            res.redirect("/login")
        })
    })
})

router.post("/signup", (req, res) => {
    if (!req.body.username || !req.body.password || !req.body.confirm_password) {
        outputError(req, "Something is missing.")
        return res.redirect("/signup")
    }

    db.query(signupSQL[0], [req.body.username, md5(req.body.password), req.body.email, false], (err, newUser) => {
        if (err) {
            console.log(err.message)
            outputError(req, "Username already exist.")
            return res.redirect("/signup")
        }

        db.query(signupSQL[2], [newUser.rows[0].id, DEVICE_ID], (err) => {
            if (err) {
                outputError(req, err.message)
                return res.redirect("/signup")
            }
            res.redirect("/signup")
        })
    })
})

router.post("/authUser", (req, res) => {
    res.json(req.body.authUser)
})

router.get("/profile", (req, res) => {
    res.render("profile", {
        title: "Profile",
        csrfToken: req.csrfToken,
        errMessage,
        successMessage,
        inputData
    })
    errMessage = ""
    successMessage = ""
    inputData = {}
})
router.post("/profile", (req, res) => {
    if (!req.body.password) {
        outputError(req, "Something is missing.")
        return res.redirect("/profile")
    }
    let reset_type = null
    if (req.body.new_username)
        reset_type = "new_username"
    else if (req.body.new_email)
        reset_type = "new_email"
    else if (req.body.new_password)
        reset_type = "new_password"
    if (!reset_type) {
        outputError(req, "Nothing given.")
        return res.redirect("/profile")
    }

    let reset_value = reset_type == "new_password" ? md5(req.body[reset_type]) : req.body[reset_type]
    db.query("SELECT username FROM auth_users WHERE username != $1", [req.body.authUser.username], (err, users_usernames) => {
        if (err)
            console.log(err)
        
        users_usernames = users_usernames.rows.map(user => user.username)
        if (reset_type == "new_username" && users_usernames.includes(reset_value)) {
            outputError(req, "Username already exists.")
            return res.redirect("/profile")
        }
        db.query(`UPDATE auth_users SET ${reset_type.slice(4)} = $1 WHERE id = $2 AND password = $3 RETURNING *`, [reset_value, req.body.authUser.user_id, md5(req.body.password)], (err, result) => {
            if (err)
                console.log(err)
            if (result && result.rowCount == 0) {
                outputError(req, "Wrong password.")
            } else {
                successMessage = "*Successfully changed"
            }
            res.redirect("/profile")
        })  
    })
})
router.get("/user/:username", (req, res) => {
    if (!req.params.username)
        return displayNotFound(req)
    db.query("SELECT * FROM auth_users WHERE username = $1", [req.params.username], (err, result) => {
        if (err)
            console.log(err)
        if (result.rowCount !== 1)
            return res.send(`Sorry, but this a user with this username does not exist.\nMaybe you have written it wrong.`)

        res.render("user", {
            csrfToken: req.csrfToken,
            currentUser: result.rows[0]
        })
    })
})

const getAuthUser = (req, res, next) => {
    db.query("SELECT * FROM auth_devices WHERE device_id = $1", [DEVICE_ID], (err, result) => {
        if (err) {
            console.log("Error: "+err.message)
            return next()
        }
        if (result.rowCount == 0) {
            db.query(signupSQL[1], [DEVICE_ID], (err) => {
                if (err)
                    console.log("Error: "+err.message)
            })
        }
        db.query(getAuthUserSQL, [DEVICE_ID], (err, result) => {
            if (err)
                console.log(err.message)
            if (result.rowCount == 0) {
                req.body.authUser = null
                if (forbiddenLoggedOut.includes(req.originalUrl))
                    return res.redirect("/")
            } else {
                req.body.authUser = result.rows[0]
                if (forbiddenLoggedIn.includes(req.originalUrl))
                    return res.redirect("/")
            }
            next()
        })
    })
}

module.exports = {
    router,
    getAuthUser
}



// use csrf_token: https://www.youtube.com/watch?v=3v6v6w4MBUw