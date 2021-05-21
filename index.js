const express = require("express")
const exphbs = require("express-handlebars")
const fs = require("fs")
const path = require("path")
const fileUpload = require("express-fileupload")
const multer = require("multer")
const { Pool, Client } = require("pg")

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
// const storage = multer.diskStorage({
//     destination: (req, file, cb) => {
//         cb(null, "./uploads")
//     },
//     filename: function(req, file, cb) {
//         cb(null, Date.now() +
//         path.extname(file.originalName))
//     }
// })
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads")
    },
    filename: (req, file, cb) => {
        console.log("this is from the multer:")
        console.log(file)
        cb(null, Date.now() + path.extname(file.originalname))
    }
})
const upload = multer({
    storage: storage,
    limits: { fieldSize: 10 * 1024 * 1024 }
})

app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(fileUpload())

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
    res.render("index")
})

app.get("/post/", (req, res) => {
    res.render("post")
})
app.get("/create", (req, res) => {
    res.render("upload")
})
app.post("/upload", upload.single("video"), (req, res) => {
    if (!req.files)
        return res.render("not_found")

    console.log("File: ", req.file)
    res.json("Created successfully")

    // console.log(req.body)
    // console.log(req.files)
    // const fileName = req.files.video.name
    // db.query("INSERT INTO videos (mimetype, caption, video) VALUES ($1, $2, $3);", [fileName.slice(fileName.lastIndexOf(".")+1), fileName, req.files.video.data], (err) => {
    //     if (err)
    //         console.log(err.message)

    //     res.redirect("/")
    // })
    // res.redirect("/")
})
app.get("/videos/:video_id", (req, res) => {
    if (!req.params.video_id)
        return res.render("not_found")

    // res.writeHead(200, {'Content-Type': 'video/mp4'});
    // res.end(uploadedVideos[req.params.video_id].video)
    res.json("Filtered")
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