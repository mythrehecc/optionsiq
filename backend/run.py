from app import create_app, db
import os

app = create_app()

if __name__ == "__main__":
    with app.app_context():
        db.create_all()
        # Create uploads folder
        os.makedirs(app.config.get("UPLOAD_FOLDER", "uploads"), exist_ok=True)
    app.run(debug=True, port=5000)
