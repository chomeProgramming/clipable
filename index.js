const express = require("express")
const exphbs = require("express-handlebars")
const fs = require("fs")
const path = require("path")

const app = express()
const PORT = process.env.PORT || 2662

app.use(express.json())
app.use(express.urlencoded({ extended: false }))

app.engine("handlebars", exphbs({ defaultLayout: "main" }))
app.set("view engine", "handlebars")

app.use("/views/static/", express.static(path.join(__dirname, "views/static")))

app.get("/", (req, res) => {
    res.render("index")
})

app.get("/post/", (req, res) => {
    res.render("post")
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