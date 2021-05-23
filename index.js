const express = require("express")
const exphbs = require("express-handlebars")
const fs = require("fs")
const path = require("path")
const fileUpload = require("express-fileupload")
const { Pool, Client } = require("pg")
const multer = require('multer')

const app = express()
const PORT = process.env.PORT || 2662

const db = new Pool({
    connectionString: require("./client").connectionString,
    ssl: {
        rejectUnauthorized: false
    }
})
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

app.use(require("./routes/user").getAuthUser)
app.use("/views/static/", express.static(path.join(__dirname, "views/static")))

app.use((req, res, next) => {
    db.query(sqls.start, (err) => {
        if (err)
            console.log(err)
        next()
    })
})

app.get("/", (req, res) => {
    db.query("SELECT * FROM videos;", (err, result) => {
        if (err)
            console.log(err.message)
        res.render("index", {
            title: "Clipable",
            videos: result.rows,
        })
    })
})
app.use("/", require("./routes/user").router)

app.get('/favicon.ico', (req, res) => {
    res.writeHead(200, {'Content-Type': 'image/jpeg'});
    res.end(fs.readFileSync("./views/static/imgs/favicon.ico"))
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
        return displayNotFound(res)
    }
    if (!req.body.title || typeof req.body.title !== "string" || typeof req.body.description !== "string") {
        console.log("Something is missing or wrong data type.")
        return displayNotFound(res)
    }

    const fileName = req.file.filename
    const file_uuid = fileName.slice(0, fileName.lastIndexOf("."))
    db.query("INSERT INTO videos (id, mimetype, title, description) VALUES ($1, $2, $3, $4);", [file_uuid, fileName.slice(fileName.lastIndexOf(".")+1), req.body.title, req.body.description?req.body.description:null], (err) => {
        if (err) {
            console.log(err.message)
            res.status(500).json({ msg: err.message })
        } else {
            res.status(200).send("Successfully completed!")
        }

        db.query("INSERT INTO uploads(upload_id, uploaded) VALUES ($1, $2)", [file_uuid, fs.readFileSync(`./uploads/videos/${fileName}`)], (err) => {
            if (err)
                console.log(err.message)
        })
    })
})

app.use("/", express.static(path.join(__dirname, "uploads"))) // later: check if exists from sql download it; else not_found
app.get("/sql/videos/:video_id", (req, res) => {
    if (!req.params.video_id)
        return displayNotFound(res)

    db.query("SELECT video FROM uploads WHERE upload_id = $1", [req.params.video_id], (err, result) => {
        if (err) {
            console.log(err.message)
            return displayNotFound(res)
        }
        if (result.rowCount == 0)
            return displayNotFound(res)

        res.writeHead(200, {'Content-Type': 'video/mp4'});
        res.end(result.rows[0].video)  
    })
})

app.get("*", (req, res) => {
    displayNotFound(res)
})

app.listen(PORT, () => {
    console.log(`App is listening to PORT: ${PORT}`)
})

// secure middlewaretoken: https://webomnizz.com/secure-post-request-with-csrf-in-nodejs/
