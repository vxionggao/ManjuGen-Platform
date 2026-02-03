import os
import sys
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

sys.path.append(os.getcwd())

# Point to the ROOT app.db
db_path = "/Users/bytedance/python_projects/app.db"
engine = create_engine(f"sqlite:///{db_path}")
Session = sessionmaker(bind=engine)
db = Session()

print("Searching for asset 'yoyo-images/GR-90728-194324.png'...")
try:
    # Find it
    result = db.execute(text("SELECT id, asset_id, name FROM assets WHERE name LIKE '%GR-90728-194324%'"))
    rows = result.fetchall()
    
    if not rows:
        print("Asset not found.")
    else:
        for r in rows:
            print(f"Deleting asset: ID={r[0]}, UUID={r[1]}, Name={r[2]}")
            # Delete it
            db.execute(text("DELETE FROM assets WHERE id = :id"), {"id": r[0]})
            db.commit()
            print("Deleted successfully.")
            
except Exception as e:
    print(f"Error: {e}")

db.close()
