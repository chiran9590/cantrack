import os

import psycopg
from dotenv import load_dotenv

load_dotenv()
from .auth import hash_pw  # noqa: E402
from .db import create_glasshouse  # noqa: E402

admin_pw = os.environ.get("SEED_ADMIN_PASSWORD", "ChangeMe123!")
users = [
    ("Admin", "admin@cantrack.local", admin_pw, "admin"),
    ("Demo Manager", "manager@cantrack.local", "Manager123!", "manager"),
    ("Demo Breeder", "breeder@cantrack.local", "Breeder123!", "breeder"),
    ("Demo Gardener", "gardener@cantrack.local", "Gardener123!", "gardener"),
]
houses = [("L1", "Glasshouse L1", 4, 6, 53), ("B2", "Glasshouse B2", 4, 6, 24), ("B3", "Glasshouse B3", 6, 6, 48)]

with psycopg.connect(os.environ["DATABASE_URL"]) as c:
    for name, email, pw, role in users:
        c.execute("insert into users(name,email,password_hash,role) values (%s,%s,%s,%s) on conflict (email) do nothing", (name, email, hash_pw(pw), role))
    if c.execute("select count(*) from glasshouses").fetchone()[0] == 0:
        for h in houses:
            create_glasshouse(c, dict(zip(["code", "name", "platforms", "columns", "rows"], h)) | {"description": ""})
        c.execute("""insert into genotypes(gid,phenomeone_id,info)
                     select 'GT-'||g, 'P1-'||g, jsonb_build_object('parentage', jsonb_build_object('mother', 'GT-'||(g-1), 'father', 'GT-'||(g+1)), 'source', 'demo data')
                     from generate_series(1000,1039) g on conflict do nothing""")
        c.execute("""insert into plants(gid,sown_date,current_position_id,created_by)
                     select 'GT-'||(1000+floor(random()*40))::int, current_date-(40+floor(random()*120))::int, position_id,
                            (select id from users where role='admin' limit 1) from positions where random() < 0.6""")
        c.execute("insert into scan_sessions(id,user_id,source) select 'S-SEED', id, 'web' from users where role='admin' limit 1")
        c.execute("""insert into plant_location_history(plant_uuid,gid,position_id,moved_at,recorded_by,source,session_id)
                     select uuid, gid, current_position_id, now()-make_interval(secs => random()*14*86400),
                            (select id from users where role='admin' limit 1), 'web', 'S-SEED' from plants""")
        # a few removed plants so reports and the plant page have something to show
        c.execute("create temp table rm on commit drop as select uuid, current_position_id from plants order by random() limit 15")
        c.execute("""insert into plant_status_history(plant_uuid,from_status,to_status,last_position_id,reason,recorded_by)
                     select uuid,'active','removed',current_position_id,'Demo: removed from programme',(select id from users where role='admin' limit 1) from rm""")
        c.execute("update plants set status='removed', current_position_id=null where uuid in (select uuid from rm)")
print("Seeded.")
print(f"  admin@cantrack.local / {admin_pw}   manager@cantrack.local / Manager123!")
print("  breeder@cantrack.local / Breeder123!   gardener@cantrack.local / Gardener123!   (change these before real use)")
