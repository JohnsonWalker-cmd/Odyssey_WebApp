from flask import Flask ,render_template, request, jsonify
from datetime import datetime, timezone, timedelta
import random, math

app = Flask(__name__)

@app.route("/")
def home():
    return  render_template("index.html")
 
@app.route("/history")
def history():
    return render_template("history.html")

@app.route("/api/data")
def api_data():
    # Dummy live telemetry that changes slightly on each request
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S %Z")
    sample = {
        "power": True,
        "mode": "manual",
        "last_seen": now,
        "forward_distance_cm": round(100 + random.random()*80, 2),
        "temperature_c": round(22 + random.random()*6, 2),
        "humidity_percent": round(40 + random.random()*20, 2),
        "air_quality_raw": int(30000 + random.random()*10000)
    }
    return jsonify(sample)

@app.route("/api/history")
def api_history():
    # Produce simple synthetic time-series for charts
    points = 60
    now = datetime.now(timezone.utc)
    label_strs = [(now.replace(microsecond=0) - timedelta(minutes=(points-1-i))).strftime('%H:%M') for i in range(points)]
    temps = [round(22 + 2*math.sin(i/6), 2) for i in range(points)]
    hums  = [round(45 + 5*math.cos(i/8), 2) for i in range(points)]
    aqs   = [int(32000 + 1500*math.sin(i/5) + 800*random.random()) for i in range(points)]
    return jsonify({
        "labels": label_strs,
        "temperature_c": temps,
        "humidity_percent": hums,
        "air_quality_raw": aqs
    })

@app.route("/command", methods=["POST"])
def command():
    payload = request.get_json(silent=True) or request.form.to_dict()
    # For now, just echo back the command received
    return jsonify({"ok": True, "received": payload})
    


if __name__ == "__main__":
    app.run(debug=True)