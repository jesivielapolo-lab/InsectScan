from flask import Flask, render_template, request, jsonify, send_file
from ultralytics import YOLO
import tempfile
from datetime import datetime
from insect_info import insect_info


# PDF
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image as RLImage
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.pagesizes import letter


# AUTH
from flask_bcrypt import Bcrypt


app = Flask(__name__)
bcrypt = Bcrypt(app)


# TRANSLATION
from deep_translator import GoogleTranslator


# ================= APP INIT =================




model = YOLO("best.pt")
history = []
users = {}


# ================= HOME =================
@app.route("/")
def home():
    return render_template("index.html")


# ================= PREDICT =================
def predict_image(path):
    results = model(path)


    if results and len(results[0].boxes) > 0:
        cls_id = int(results[0].boxes.cls[0])
        return results[0].names[cls_id]


    return "unknown"




@app.route("/predict", methods=["POST"])
def predict():
    file = request.files["image"]


    path = tempfile.mktemp(".jpg")
    file.save(path)


    label = predict_image(path)


    info = insect_info.get(label, {
        "description": f"Detected insect: {label}",
        "danger_level": "Unknown",
        "insecticide": ["No data available"],
        "safety_tips": "No recommendation available"
    })


    result = {
        "label": label,
        "description": info["description"],
        "danger_level": info["danger_level"],
        "insecticide": info["insecticide"],
        "tips": info["safety_tips"]
    }


    history.append(result)
    return jsonify(result)


# ================= SEARCH =================
@app.route("/search")
def search():
    query = request.args.get("q", "").strip()


    if not query:
        return jsonify({"url": "https://www.google.com"})


    label = query.split("\n")[0]
    label = label.replace("Detected:", "").strip()


    url = f"https://www.google.com/search?q={label}+insect+pest+control"


    return jsonify({"url": url})


# ================= PDF =================
@app.route("/print_pdf", methods=["POST"])
def print_pdf():
    label = request.form.get("label", "")
    description = request.form.get("description", "")
    danger = request.form.get("danger", "")
    insecticide = request.form.get("insecticide", "")
    tips = request.form.get("tips", "")


    img_file = request.files.get("image")
    img_path = None


    if img_file:
        img_path = tempfile.mktemp(".jpg")
        img_file.save(img_path)


    filename = f"InsectScan_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    doc = SimpleDocTemplate(filename, pagesize=letter)


    styles = getSampleStyleSheet()


    title_style = ParagraphStyle(
        "TitleBig",
        parent=styles["Title"],
        fontSize=26,
        leading=30
    )


    text_style = ParagraphStyle(
        "BigText",
        parent=styles["Normal"],
        fontSize=16,
        leading=20
    )


    content = []


    content.append(Paragraph("InsectScan Report", title_style))
    content.append(Spacer(1, 10))


    content.append(Paragraph(
        f"Date & Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        text_style
    ))
    content.append(Spacer(1, 10))


    if img_path:
        content.append(RLImage(img_path, width=300, height=300))
        content.append(Spacer(1, 10))


    content.append(Paragraph(f"<b>Detected:</b> {label}", text_style))
    content.append(Paragraph(f"<b>Description:</b> {description}", text_style))
    content.append(Paragraph(f"<b>Danger Level:</b> {danger}", text_style))
    content.append(Paragraph(f"<b>Insecticide:</b> {insecticide}", text_style))
    content.append(Paragraph(f"<b>Tips:</b> {tips}", text_style))


    doc.build(content)


    return send_file(filename, as_attachment=True)


# ================= TRANSLATE =================
@app.route("/translate", methods=["POST"])
def translate():
    data = request.json


    translated = GoogleTranslator(
        source="auto",
        target=data["lang"]
    ).translate(data["text"])


    return jsonify({"translated": translated})


# ================= AUTH =================
@app.route("/register", methods=["POST"])
def register():
    data = request.json
    email = data["email"]
    password = data["password"]


    if email in users:
        return jsonify({"msg": "User already exists"}), 400


    hashed = bcrypt.generate_password_hash(password).decode("utf-8")
    users[email] = hashed


    return jsonify({"msg": "Registered successfully"})




@app.route("/login", methods=["POST"])
def login():
    data = request.json
    email = data["email"]
    password = data["password"]


    if email not in users:
        return jsonify({"msg": "User not found"}), 404


    if bcrypt.check_password_hash(users[email], password):
        return jsonify({"msg": "Login success"})
    else:
        return jsonify({"msg": "Wrong password"}), 401
   
@app.route("/history", methods=["GET"])
def get_history():
    return jsonify(history)


# ================= RUN =================
if __name__ == "__main__":
    app.run(debug=True)

