import io
import pandas as pd
from app.db.session import SessionLocal
from app.lands.service import export_land_to_excel

db = SessionLocal()
output = export_land_to_excel(db, 4)
with open('test_output.xlsx', 'wb') as f:
    f.write(output.getvalue())

df = pd.read_excel('test_output.xlsx', sheet_name='Summary')
print(df.to_string())
