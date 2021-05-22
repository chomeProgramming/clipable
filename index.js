const express = require("express")
const exphbs = require("express-handlebars")
const fs = require("fs")
const path = require("path")
const fileUpload = require("express-fileupload")
const { Pool, Client } = require("pg")
const multer = require('multer');

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

const app = express()
const PORT = process.env.PORT || 2662

const db = new Pool({
    connectionString: require("./client").connectionString,
    ssl: {
        rejectUnauthorized: false
    }
})
// db.connect()  // only at Client
const sqls = {
    start: fs.readFileSync("./sql/start.sql").toString(),
}

app.use(express.json())
app.use(express.urlencoded({ extended: false }))

app.engine("handlebars", exphbs({ defaultLayout: "main" }))
app.set("view engine", "handlebars")

app.use("/views/static/", express.static(path.join(__dirname, "views/static")))

app.use((req, res, next) => {
    db.query(sqls.start, (err) => {
        if (err)
            console.log(err)
        next()
    })
})

app.get("/", (req, res) => {
    db.query("SELECT id, caption, mimetype FROM videos;", (err, result) => {
        if (err)
            console.log(err.message)
        res.render("index", {
            title: "Clipable",
            videos: result.rows
        })
    })
})

app.get("/post/", (req, res) => {
    res.render("post")
})
app.get("/create", (req, res) => {
    res.render("upload")
})
app.post("/upload", upload.single("video"), (req, res) => {
    if (!req.file) {
        console.log("Error: Not get file from multer")
        return res.render("not_found")
    }

    console.log(req.file)
    const fileName = req.file.filename
    db.query("INSERT INTO videos (id, mimetype, caption, video) VALUES ($1, $2, $3, $4);", [fileName.slice(0, fileName.lastIndexOf(".")), fileName.slice(fileName.lastIndexOf(".")+1), fileName, fs.readFileSync(`./uploads/videos/${fileName}`)], (err) => {
        if (err)
            console.log(err.message)

        res.redirect("/")
    })
})

app.use("/", express.static(path.join(__dirname, "uploads"))) // later: check if exists in sql download it; else not_found
app.get("/sql/videos/:video_id", (req, res) => {
    if (!req.params.video_id)
        return res.render("not_found")

    db.query("SELECT video FROM videos WHERE id = $1", [req.params.video_id], (err, result) => {
        if (err) {
            console.log(err.message)
            return res.render("not_found")
        }
        if (result.rowCount == 0)
            return res.render("not_found")

        res.writeHead(200, {'Content-Type': 'video/mp4'});
        res.end(result.rows[0].video)  
    })
})

app.get('/favicon.ico', (req, res) => {
    res.writeHead(200, {'Content-Type': 'image/jpeg'});
    res.end(fs.readFileSync("./views/static/imgs/favicon.ico"))
})
app.get("*", (req, res) => {
    res.render("not_found")
})

app.listen(PORT, () => {
    console.log(`App is listening to PORT: ${PORT}`)
})

// secure middlewaretoken: https://webomnizz.com/secure-post-request-with-csrf-in-nodejs/
