"""Demo data:  python -m app.seed            (users, 3 glasshouses, genotypes, plants, history)
Only an admin account:  python -m app.seed --admin-only     (use this for a real deployment)"""
import json
import os
import random
import sys
import uuid as uuid_lib
from datetime import datetime, timedelta

from dotenv import load_dotenv

from .auth import hash_pw
from .db import create_glasshouse, describe_url, get_connection

load_dotenv()
ADMIN_ONLY = "--admin-only" in sys.argv

admin_pw = os.environ.get("SEED_ADMIN_PASSWORD", "ChangeMe123!")
users = [("Admin", "admin@cantrack.local", admin_pw, "admin")]
if not ADMIN_ONLY:
    users += [
        ("Demo Manager", "manager@cantrack.local", "Manager123!", "manager"),
        ("Demo Breeder", "breeder@cantrack.local", "Breeder123!", "breeder"),
        ("Demo Gardener", "gardener@cantrack.local", "Gardener123!", "gardener"),
    ]
houses = [("L1", "Glasshouse L1", 4, 6, 53), ("B2", "Glasshouse B2", 4, 6, 24), ("B3", "Glasshouse B3", 6, 6, 48)]

with get_connection() as conn:   # one transaction: all or nothing
    with conn.cursor() as cur:
        for name, email, pw, role in users:
            # Check if user already exists to avoid duplicate error
            cur.execute("SELECT id FROM users WHERE email = %s", (email,))
            if cur.fetchone() is None:
                cur.execute("insert into users(name,email,password_hash,role) values (%s,%s,%s,%s)",
                           (name, email, hash_pw(pw), role))

        cur.execute("select id from users where role='admin' order by id limit 1")
        result = cur.fetchone()
        if result is None:
            print("ERROR: Admin user not found after seeding")
            sys.exit(1)
        admin_id = result["id"]

        if not ADMIN_ONLY:
            cur.execute("select count(*) as n from glasshouses")
            if cur.fetchone()["n"] == 0:
                for h in houses:
                    create_glasshouse(cur, dict(zip(["code", "name", "platforms", "columns", "rows"], h)) | {"description": ""})

                for g in range(1000, 1040):
                    info = json.dumps({"parentage": {"mother": f"GT-{g-1}", "father": f"GT-{g+1}"}, "source": "demo data"})
                    cur.execute("insert into genotypes(gid,phenomeone_id,info) values (%s,%s,%s)", (f"GT-{g}", f"P1-{g}", info))

                cur.execute("select position_id from positions")
                for pos in cur.fetchall():
                    if random.random() < 0.6:
                        sown = (datetime.now() - timedelta(days=random.randint(40, 160))).date()
                        cur.execute("insert into plants(uuid,gid,sown_date,current_position_id,created_by) values (%s,%s,%s,%s,%s)",
                                   (str(uuid_lib.uuid4()), f"GT-{random.randint(1000, 1039)}", sown, pos["position_id"], admin_id))

                cur.execute("insert into scan_sessions(id,user_id,source) values ('S-SEED',%s,'web')", (admin_id,))
                cur.execute("select uuid, gid, current_position_id from plants")
                for pl in cur.fetchall():
                    moved_at = datetime.now() - timedelta(seconds=random.random() * 14 * 86400)
                    cur.execute("""insert into plant_location_history(plant_uuid,gid,position_id,moved_at,recorded_by,source,session_id)
                                    values (%s,%s,%s,%s,%s,'web','S-SEED')""", (pl["uuid"], pl["gid"], pl["current_position_id"], moved_at, admin_id))

                cur.execute("select uuid, current_position_id from plants order by rand() limit 15")
                for pl in cur.fetchall():
                    cur.execute("""insert into plant_status_history(plant_uuid,from_status,to_status,last_position_id,reason,recorded_by)
                                    values (%s,'active','removed',%s,'Demo: removed from programme',%s)""", (pl["uuid"], pl["current_position_id"], admin_id))
                    cur.execute("update plants set status='removed', current_position_id=null where uuid=%s", (pl["uuid"],))

print(f"Seeded {describe_url()}")
print(f"  admin@cantrack.local / {admin_pw}")
if not ADMIN_ONLY:
    print("  manager@cantrack.local / Manager123!   breeder@cantrack.local / Breeder123!   gardener@cantrack.local / Gardener123!")
print("  (change these passwords before real use)")
