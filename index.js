const express = require("express")
const exphbs = require("express-handlebars")
// const jwt = require("jsonwebtoken")
const fs = require("fs")
const path = require("path")
// const fileUpload = require("express-fileupload")
const { Pool, Client } = require("pg")
const multer = require('multer')
const csrf = require("csurf")
const session = require("express-session")
const cookieParser = require("cookie-parser")
const MemoryStore = require("memorystore")(session)
// const { LocalStorage } = require("node-localstorage")
// const authorize = require("./routes/authorization-middleware")

const app = express()
const PORT = process.env.PORT || 2662

const db = require("./client").dbPoolConnection
// db.connect()  // only at Client

// const upload = multer({ dest: './uploads/' })
const fileStorageEngine = multer.diskStorage({
    destination: (req, file, cb) => {
        if (file.mimetype.split("/")[0] == "video")
            cb(null, './uploads/videos')
        else
            cb(null, './uploads/images')
    },
    filename: (req, file, cb) => {
        db.query("SELECT uuid_generate_v4()", (err, result) => {
            if (err)
                console.log(err)

            // cb(null, Date.now() + "--" + file.originalname)
            cb(null, result.rows[0].uuid_generate_v4 + "." + file.originalname.slice(1+file.originalname.lastIndexOf(".")))
            // cb(null, result.rows[0].uuid_generate_v4)
        })
    }
})
const upload = multer({ storage: fileStorageEngine })

// multer example: https://www.youtube.com/watch?v=srPXMt1Q0nY
// more info for multer in: multer_hint.txt

const sqls = {
    start: fs.readFileSync("./sql/start.sql").toString(),
}
const displayNotFound = res => {
    res.sendFile(path.join(__dirname, "./views/not_found.html"))
}

app.use(express.json())
app.use(express.urlencoded({ extended: false }))

app.engine("handlebars", exphbs({ defaultLayout: "main" }))
app.set("view engine", "handlebars")

app.use(cookieParser())
app.use(session({
    store: new MemoryStore({
        // checkPeriod: 10000 // prune expired entries every 24h
    }),
    secret: require("./config.js").JWT_SECRET,
    resave: false,
    saveUninitialized: false
}))
// app.use(csrf({ cookie: true }))
app.use(csrf())

// db.query("DELETE FROM auth_devices;", (err) => {
//     if (err)
//         console.log(err)
// })
app.use((req, res, next) => {
    db.query(sqls.start, (err) => {
        if (err)
            console.log(err)
        next()
    })
})

app.use(require("./routes/user").getAuthUser)
app.use("/views/static/", express.static(path.join(__dirname, "views/static")))

app.get("/", (req, res) => {
    db.query("SELECT * FROM videos;", (err, result) => {
        if (err)
            console.log(err.message)
        res.render("index", {
            title: "Clipable",
            videos: result.rows,
            csrfToken: req.csrfToken
        })
    })
})

app.use("/", require("./routes/uploads").router)
app.use("/", require("./routes/user").router)

// app.post("/token", (req, res) => {
//     let payload = {}
//     if (req.body.authUser)
//         payload = {
//             authUser: req.body.authUser,
//             scopes: ["customer:default"]
//         }
//     else
//         payload = {
//             scopes: ["customer:read"]
//         }
//     const token = jwt.sign(payload, require("./config").JWT_SECRET)
//     res.send(token)
// })
app.get("/discover", (req, res) => {
    if (!req.query.search) {
        return db.query("SELECT * FROM videos;", (err, searchedResults) => {
            if (err) console.log(err)
            return res.render("discover", {
                title: "Discover",
                csrfToken: req.csrfToken,
                searchedResults: searchedResults.rows,
                isOverview: true,
                nothingFound: searchedResults.length == 0
            })
        })
    }

    const findPairs = type => {
        var searchParam = req.query.search
        var pairs = []
        var position = 0
        while (position < req.query.search.length && position !== -1) {
            var rendered1 = searchParam.slice(position).search(type) + position
            // console.log("rendered1: ", rendered1)
            if (rendered1 == -1) {
                position = -1
                continue
            }

            var rendered2 = searchParam.slice(rendered1 + 1).search(type) + rendered1 + 1
            // console.log("rendered2: ", rendered2)
            if (rendered2 !== -1 && rendered2 > rendered1) {
                if (rendered1 + 1 !== rendered2)
                    pairs.push([rendered1, rendered2])
                position = rendered2 + 1
            } else
                position = -1

            // console.log("position: ", position)
        }
        return pairs
    }
    const searchBy = type => {
        let lv_searchBy = []
        const searchWords = req.query.search.split(" ")
        for (var i = 0; i < searchWords.length; i++) {
            lv_searchBy.push(`$${ i + 1 }`)
        }
        lv_searchBy = lv_searchBy.join(` OR ${type} ILIKE `)

        return {
            sql: `${type} ILIKE ${lv_searchBy}`,
            items: searchWords.map(word => `%${word}%`)
        }
    }

    const mustWords = findPairs("\"").map(position => req.query.search.slice(position[0] + 1, position[1]))

    const mustWordsRender = type => {
        let result = []
        var searchByLength = searchBy("").items.length
        for (var i = 0; i < mustWords.length; i++) {
            result.push(`$${ i + 1 + searchByLength}`)
        }
        result = result.join(` AND ${type} ILIKE `)

        if (mustWords.length == 0)
            return {
                sql: `${type} ILIKE '%%'`,
                items: [],
                inOr: ""
            }
        return {
            sql: `${type} ILIKE ${result}`,
            items: mustWords.map(word => `%${word}%`),
            inOr: "OR title ILIKE '%%' OR description ILIKE '%%'"
        }
    }

    const searchSQL = `SELECT * FROM videos WHERE (${searchBy("title").sql} OR ${searchBy("description").sql} ${mustWordsRender("").inOr}) AND (${mustWordsRender("title").sql} OR ${mustWordsRender("description").sql});`

    db.query(searchSQL, [...searchBy("").items, ...mustWordsRender("").items], (err, searchedResults) => {
        if (err) console.log(err)
        searchedResults = searchedResults.rows.sort((a, b) => {
            var aCount = 0
            var bCount = 0
            req.query.search.split(" ").forEach(word => {
                word = word.toLowerCase()
                if (a.title.toLowerCase().includes(word) || (a.description && a.description.toLowerCase().includes(word)))
                    aCount++
                if (b.title.toLowerCase().includes(word) || (b.description && b.description.toLowerCase().includes(word)))
                    bCount++
            })
            return bCount - aCount
        })
        return res.render("discover", {
            title: "Discover",
            csrfToken: req.csrfToken,
            searchedResults: searchedResults,
            inputData: req.query,
            nothingFound: searchedResults.length == 0
        })
    })
})

app.get('/favicon.ico', (req, res) => {
    res.writeHead(200, {'Content-Type': 'image/jpeg'});
    res.end(fs.readFileSync("./views/static/imgs/favicon.ico"))
})

app.get("*", (req, res) => {
    displayNotFound(res)
})

app.listen(PORT, () => {
    console.log(`App is listening to PORT: ${PORT}`)
})

// secure middlewaretoken: https://webomnizz.com/secure-post-request-with-csrf-in-nodejs/
