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
const outputError = (req, error) => {
    errMessage = error
    inputData = req.body
}
const forbiddenLoggedOut = ["/logout"]
const forbiddenLoggedIn = ["/login", "/signup"]

router.get("/login", (req, res) => {
    res.render("login", {
        layout: "user",
        title: "Login",
        errMessage: errMessage,
        inputData: inputData,
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

        res.redirect("/login")
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

router.get('/profile', (req, res) => {
    res.render("profile", {
        title: "Profile"
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