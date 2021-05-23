const defaultThemeColor = "dark-mode"

if (!localStorage.getItem("theme-color"))
    localStorage.setItem("theme-color", defaultThemeColor)

document.getElementById("themeStylesheet").href = "/views/static/" + localStorage.getItem("theme-color") + ".css"