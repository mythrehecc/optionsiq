from app import create_app, db
import os

print("🚀 Before create_app")   # ADD

app = create_app()

print("✅ After create_app")    # ADD

if __name__ == "__main__":
    print("🔥 Inside main")     # ADD

    with app.app_context():
        print("📦 Creating DB")  # ADD
        db.create_all()

        os.makedirs(app.config.get("UPLOAD_FOLDER", "uploads"), exist_ok=True)

    print("🚀 Running server")   # ADD
    app.run(debug=True, port=5000)