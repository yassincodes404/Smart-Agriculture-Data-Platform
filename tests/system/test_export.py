import sys
import io
import traceback
import pandas as pd
from app.db.session import SessionLocal
from app.lands.service import export_land_to_excel

def main():
    db = SessionLocal()
    try:
        print("Testing export for land 4...")
        output = export_land_to_excel(db, 4)
        if output:
            print("Success! Size:", len(output.getvalue()))
        else:
            print("No land found.")
    except Exception as e:
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    main()
