import os
import uuid as uuid_lib
import json
from datetime import datetime, timedelta

from dotenv import load_dotenv
from .db import get_connection, create_glasshouse
from .auth import hash_pw  # noqa: E402

load_dotenv()

admin_pw = os.environ.get("SEED_ADMIN_PASSWORD", "ChangeMe123!")
users = [
    ("Admin", "admin@cantrack.local", admin_pw, "admin"),
    ("Demo Manager", "manager@cantrack.local", "Manager123!", "manager"),
    ("Demo Breeder", "breeder@cantrack.local", "Breeder123!", "breeder"),
    ("Demo Gardener", "gardener@cantrack.local", "Gardener123!", "gardener"),
]
houses = [("L1", "Glasshouse L1", 4, 6, 53), ("B2", "Glasshouse B2", 4, 6, 24), ("B3", "Glasshouse B3", 6, 6, 48)]

conn = get_connection()
try:
    with conn.cursor() as c:
        # Insert users
        for name, email, pw, role in users:
            c.execute("insert into users(name,email,password_hash,role) values (%s,%s,%s,%s) on duplicate key update email=email", 
                      (name, email, hash_pw(pw), role))
        
        # Check if glasshouses exist
        c.execute("select count(*) as cnt from glasshouses")
        glasshouse_count = c.fetchone()['cnt']
        
        if glasshouse_count == 0:
            # Create glasshouses
            for h in houses:
                create_glasshouse(c, dict(zip(["code", "name", "platforms", "columns", "rows"], h)) | {"description": ""})
            
            # Insert genotypes
            for g in range(1000, 1040):
                gid = f"GT-{g}"
                phenomeone_id = f"P1-{g}"
                info = json.dumps({
                    "parentage": {
                        "mother": f"GT-{g-1}",
                        "father": f"GT-{g+1}"
                    },
                    "source": "demo data"
                })
                c.execute("insert into genotypes(gid,phenomeone_id,info) values (%s,%s,%s)", (gid, phenomeone_id, info))
            
            # Get admin user id
            c.execute("select id from users where role='admin' limit 1")
            admin_id = c.fetchone()['id']
            
            # Get all positions
            c.execute("select position_id from positions")
            positions = c.fetchall()
            
            # Insert plants with random positions
            import random
            for pos in positions:
                if random.random() < 0.6:
                    gid = f"GT-{random.randint(1000, 1039)}"
                    plant_uuid = str(uuid_lib.uuid4())
                    sown_date = datetime.now() - timedelta(days=random.randint(40, 160))
                    c.execute("insert into plants(uuid,gid,sown_date,current_position_id,created_by) values (%s,%s,%s,%s,%s)",
                              (plant_uuid, gid, sown_date.date(), pos['position_id'], admin_id))
            
            # Insert scan session
            c.execute("insert into scan_sessions(id,user_id,source) values (%s,%s,%s)", ('S-SEED', admin_id, 'web'))
            
            # Insert plant location history
            c.execute("select uuid, gid, current_position_id from plants")
            plants = c.fetchall()
            for plant in plants:
                moved_at = datetime.now() - timedelta(seconds=random.random() * 14 * 86400)
                c.execute("""insert into plant_location_history(plant_uuid,gid,position_id,moved_at,recorded_by,source,session_id)
                           values (%s,%s,%s,%s,%s,%s,%s)""",
                          (plant['uuid'], plant['gid'], plant['current_position_id'], moved_at, admin_id, 'web', 'S-SEED'))
            
            # Remove some plants
            c.execute("select uuid, current_position_id from plants order by rand() limit 15")
            removed_plants = c.fetchall()
            for plant in removed_plants:
                c.execute("""insert into plant_status_history(plant_uuid,from_status,to_status,last_position_id,reason,recorded_by)
                           values (%s,%s,%s,%s,%s,%s)""",
                          (plant['uuid'], 'active', 'removed', plant['current_position_id'], 'Demo: removed from programme', admin_id))
                c.execute("update plants set status='removed', current_position_id=null where uuid=%s", (plant['uuid'],))
    
    conn.commit()
finally:
    conn.close()
print("Seeded.")
print(f"  admin@cantrack.local / {admin_pw}   manager@cantrack.local / Manager123!")
print("  breeder@cantrack.local / Breeder123!   gardener@cantrack.local / Gardener123!   (change these before real use)")
