let currentFile = null;
let stream = null;
let currentLang = "en";
let selectedRating = 0;

// ================= SAFE DOM =================
const $ = (id) => document.getElementById(id);

// ================= INIT =================
window.addEventListener("load", () => {
    currentLang = localStorage.getItem("lang") || "en";

    const langSelect = $("langSelect");
    if (langSelect) langSelect.value = currentLang;

    applySavedSettings();

    const container = document.querySelector(".container");
    if (container) container.style.display = "none";
});

// ================= MENU =================
function toggleMenu() {
    const menu = $("menu");
    if (menu) menu.classList.toggle("open");
}

// ================= SAFE FETCH =================
async function safeFetch(url, options) {
    try {
        const res = await fetch(url, options);
        return await res.json();
    } catch (err) {
        console.error("Fetch error:", err);
        return null;
    }
}

// ================= PREDICT =================
async function predict() {
    if (!currentFile) return alert("Please upload or capture an image first.");

    const output = $("output");
    if (output) output.innerHTML = "🔄 Processing...";

    let form = new FormData();
    form.append("image", currentFile);

    let data = await safeFetch("/predict", {
        method: "POST",
        body: form
    });

    if (!data || !output) return;

    sessionStorage.setItem("lastResult", JSON.stringify(data));

    let insecticideRaw = Array.isArray(data.insecticide)
        ? data.insecticide.join(", ")
        : (data.insecticide || "");

    let translated = await translateBatch([
        "Detected",
        "Description",
        "Danger Level",
        "Insecticide",
        "Tips",
        data.label,
        data.description,
        data.danger_level || data.danger,
        insecticideRaw,
        data.tips
    ]);

    const [
        tDetected,
        tDescription,
        tDanger,
        tInsecticide,
        tTips,
        label,
        description,
        danger,
        insecticide,
        tips
    ] = translated;

    output.innerHTML = `
        🌾 <b>${tDetected}:</b> ${label}<br><br>
        📄 <b>${tDescription}:</b> ${description}<br><br>
        ⚠️ <b>${tDanger}:</b> ${danger}<br><br>
        🧪 <b>${tInsecticide}:</b> ${insecticide}<br><br>
        💡 <b>${tTips}:</b> ${tips}
    `;

    const panel = document.getElementById("reportPanel");
    if (panel && label && label !== "unknown") {
        panel.classList.add("open");
    }
}

// ================= CAMERA =================
async function startCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" }
        });

        const video = $("video");
        if (video) video.srcObject = stream;

    } catch {
        alert("Camera not available.");
    }
}

// ================= CAPTURE =================
function captureImage() {
    const video = $("video");
    const canvas = $("canvas");
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);

    canvas.toBlob(blob => {
        currentFile = new File([blob], "camera.png", { type: "image/png" });

        const reader = new FileReader();
        reader.onload = () => {
            const preview = $("preview");
            if (preview) {
                preview.src = reader.result;
                preview.style.display = "block";
            }
        };
        reader.readAsDataURL(currentFile);
    });
}

// ================= UPLOAD =================
function openUpload() {
    $("img")?.click();
}

function previewImage(event) {
    currentFile = event.target.files[0];

    const reader = new FileReader();
    reader.onload = () => {
        const img = $("preview");
        if (img) {
            img.src = reader.result;
            img.style.display = "block";
        }
    };
    reader.readAsDataURL(currentFile);
}

// ================= CLEAR =================
function clearOutput() {
    $("output") && ($("output").innerHTML = "No detection yet...");
    $("preview") && ($("preview").src = "");

    currentFile = null;

    if (stream) {
        stream.getTracks().forEach(t => t.stop());
        stream = null;
    }
}

// ================= SEARCH =================
function openSearch() {
    const text = $("output")?.innerText || "";

    fetch("/search?q=" + encodeURIComponent(text))
        .then(r => r.json())
        .then(data => window.open(data.url, "_blank"));
}

// ================= PRINT =================
async function printReport() {
    let data = JSON.parse(sessionStorage.getItem("lastResult") || "{}");

    let translated = await translateBatch([
        data.label,
        data.description,
        data.danger_level || data.danger,
        data.insecticide,
        data.tips
    ]);

    let formData = new FormData();
    formData.append("label", translated[0]);
    formData.append("description", translated[1]);
    formData.append("danger", translated[2]);
    formData.append("insecticide", translated[3]);
    formData.append("tips", translated[4]);

    if (currentFile) formData.append("image", currentFile);

    let res = await fetch("/print_pdf", {
        method: "POST",
        body: formData
    });

    let blob = await res.blob();
    let url = URL.createObjectURL(blob);

    let a = document.createElement("a");
    a.href = url;
    a.download = "InsectScan_Report.pdf";
    a.click();
}

// ================= LANGUAGE =================
function changeLanguage() {
    const select = $("langSelect");
    if (!select) return;

    currentLang = select.value;
    localStorage.setItem("lang", currentLang);
}

// ================= TRANSLATION =================
async function translateBatch(texts) {
    if (currentLang === "en") return texts;

    try {
        let res = await fetch("/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                lang: currentLang,
                text: texts.join("|||")
            })
        });

        let data = await res.json();
        return data.translated.split("|||");

    } catch {
        return texts;
    }
}

// ================= AUTH SAFE GUARD =================
if (typeof auth !== "undefined") {
    auth.onAuthStateChanged(user => {
        const login = $("loginScreen");
        const app = document.querySelector(".container");

        if (!login || !app) return;

        login.style.display = user ? "none" : "flex";
        app.style.display = user ? "block" : "none";
    });
}

// ================= SETTINGS =================
function saveSettings() {
    const nickname = document.getElementById("nickname").value;
    const fontSize = document.querySelector('input[type="range"][min="12"]').value;
    const brightness = document.querySelector('input[type="range"][min="50"]').value;
    const theme = document.getElementById("themeSelect").value;

    localStorage.setItem("nickname", nickname);
    localStorage.setItem("fontSize", fontSize);
    localStorage.setItem("brightness", brightness);
    localStorage.setItem("theme", theme);

    alert("Settings saved!");
}
function closeReport() {
    const panel = document.getElementById("reportPanel");
    if (panel) panel.classList.remove("open");
}

function openFeedback() {
    $("feedbackPanel")?.classList.add("open");
}

function closeFeedback() {
    $("feedbackPanel")?.classList.remove("open");
}

function submitFeedback() {
    const text = $("feedbackText").value.trim();

    if (!text) {
        alert("Please write something first.");
        return;
    }

    // Save locally (history of feedback)
    let feedbackList = JSON.parse(localStorage.getItem("feedbacks") || "[]");

    feedbackList.push({
        text: text,
        date: new Date().toLocaleString()
    });

    localStorage.setItem("feedbacks", JSON.stringify(feedbackList));

    // OPTIONAL: send to backend
    /*
    fetch("/feedback", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ message: text })
    });
    */

    alert("✅ Feedback submitted!");

    $("feedbackText").value = "";
    closeFeedback();
}

function loadHistory() {
    alert("History feature not implemented yet.");
}

function openSettings() {
    document.getElementById("settingsPanel")?.classList.add("open");
}

function closeSettings() {
    document.getElementById("settingsPanel")?.classList.remove("open");
}

function changeTheme(value) {
    document.body.classList.remove("dark", "green", "purple", "cyan");

    if (value !== "light") {
        document.body.classList.add(value);
    }

    localStorage.setItem("theme", value);
}

function changeAvatar(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = function () {
        const base64 = reader.result;

        document.getElementById("avatarPreview").src = base64;
        localStorage.setItem("avatar", base64);
    };

    reader.readAsDataURL(file);
}

function loadSettings() {
    const nickname = localStorage.getItem("nickname") || "";
    const font = localStorage.getItem("fontSize") || 16;
    const brightness = localStorage.getItem("brightness") || 100;
    const theme = localStorage.getItem("theme") || "light";
    const avatar = localStorage.getItem("avatar");

    document.getElementById("nickname").value = nickname;

    // Apply visually
    document.body.style.fontSize = font + "px";
    document.body.style.filter = `brightness(${brightness}%)`;

    document.body.classList.remove("dark", "green", "purple", "cyan");
    if (theme !== "light") {
        document.body.classList.add(theme);
    }

    // Update sliders + labels
    document.querySelector('input[type="range"][min="12"]').value = font;
    document.querySelector('input[type="range"][min="50"]').value = brightness;

    document.getElementById("fontValue").innerText = font;
    document.getElementById("brightnessValue").innerText = brightness;

    document.getElementById("themeSelect").value = theme;

    if (avatar) {
        document.getElementById("avatarPreview").src = avatar;
    }
}

window.addEventListener("load", () => {
    loadSettings();
});

function changeFontSize(value) {
    document.body.style.fontSize = value + "px";
    document.getElementById("fontValue").innerText = value;
}

function changeBrightness(value) {
    document.body.style.filter = `brightness(${value}%)`;
    document.getElementById("brightnessValue").innerText = value;
}

function setRating(rating) {
    selectedRating = rating;

    const stars = document.querySelectorAll(".star");

    stars.forEach((star, index) => {
        star.classList.toggle("active", index < rating);
    });

    document.getElementById("ratingText").innerText =
        `Rating: ${rating} / 5`;
}

function saveToHistory(data) {
    let history = JSON.parse(localStorage.getItem("history") || "[]");

    history.unshift({
        label: data.label,
        description: data.description,
        danger: data.danger_level || data.danger,
        insecticide: data.insecticide,
        tips: data.tips,
        date: new Date().toLocaleString()
    });

    // limit to last 20
    history = history.slice(0, 20);

    localStorage.setItem("history", JSON.stringify(history));
}

function loadHistory() {
    const panel = $("historyPanel");
    const list = $("historyList");

    if (!panel || !list) return;

    let history = JSON.parse(localStorage.getItem("history") || "[]");

    if (history.length === 0) {
        list.innerHTML = "<p>No history yet.</p>";
    } else {
        list.innerHTML = history.map((item, index) => `
            <div style="
                padding:10px;
                margin-bottom:10px;
                border-radius:10px;
                background:rgba(255,255,255,0.05);
                cursor:pointer;
            " onclick="openHistoryItem(${index})">

                <b>${item.label}</b><br>
                <small>${item.date}</small>
            </div>
        `).join("");
    }

    panel.classList.add("open");
}

function openHistoryItem(index) {
    let history = JSON.parse(localStorage.getItem("history") || "[]");
    let item = history[index];

    if (!item) return;

    const panel = $("reportPanel");
    const output = $("output");

    if (!panel || !output) return;

    output.innerHTML = `
        🌾 <b>Detected:</b> ${item.label}<br><br>
        📄 <b>Description:</b> ${item.description}<br><br>
        ⚠️ <b>Danger:</b> ${item.danger}<br><br>
        🧪 <b>Insecticide:</b> ${item.insecticide}<br><br>
        💡 <b>Tips:</b> ${item.tips}
    `;

    panel.classList.add("open");
}

function closeHistory() {
    $("historyPanel")?.classList.remove("open");
}

if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("/sw.js")
            .then(() => console.log("Service Worker registered"))
            .catch(err => console.log("SW failed:", err));
    });
}