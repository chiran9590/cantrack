import pymysql
import os
import json
import uuid
import random
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ['DATABASE_URL']
import re
m = re.match(r'mysql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)', db_url)
conn = pymysql.connect(host=m.group(3), port=int(m.group(4)), user=m.group(1), password=m.group(2), database=m.group(5))
cur = conn.cursor()

# Get admin ID
cur.execute('SELECT id FROM users WHERE role="admin" LIMIT 1')
admin_id = cur.fetchone()[0]

# Insert positions for all glasshouses
houses = [('L1', 4, 6, 53), ('B2', 4, 6, 24), ('B3', 6, 6, 48)]
for code, platforms, columns, rows in houses:
    for p in range(1, platforms + 1):
        for c in range(1, columns + 1):
            for r in range(1, rows + 1):
                pos_id = f'{code}-P{str(p).zfill(2)}-C{str(c).zfill(2)}-R{str(r).zfill(2)}'
                cur.execute('INSERT IGNORE INTO positions(position_id, glasshouse_code, platform_no, column_no, row_no) VALUES (%s, %s, %s, %s, %s)', 
                           (pos_id, code, p, c, r))

conn.commit()
print(f'Inserted positions')

# Add genotypes
for g in range(1000, 1040):
    info = json.dumps({'parentage': {'mother': f'GT-{g-1}', 'father': f'GT-{g+1}'}, 'source': 'demo data'})
    cur.execute('INSERT IGNORE INTO genotypes(gid,phenomeone_id,info) VALUES (%s,%s,%s)', (f'GT-{g}', f'P1-{g}', info))

conn.commit()
print(f'Inserted genotypes')

# Add plants at some positions
cur.execute('SELECT position_id FROM positions')
all_positions = [row[0] for row in cur.fetchall()]
random.shuffle(all_positions)

# Add scan session
cur.execute('INSERT IGNORE INTO scan_sessions(id,user_id,source) VALUES (%s,%s,"web")', ('S-DEMO', admin_id))

# Add plants to ~60% of positions
for i, pos_id in enumerate(all_positions[:int(len(all_positions) * 0.6)]):
    sown = (datetime.now() - timedelta(days=random.randint(40, 160))).date()
    gid = f'GT-{random.randint(1000, 1039)}'
    plant_uuid = str(uuid.uuid4())
    cur.execute('INSERT INTO plants(uuid,gid,sown_date,current_position_id,created_by) VALUES (%s,%s,%s,%s,%s)', 
                (plant_uuid, gid, sown, pos_id, admin_id))
    
    # Add location history
    moved_at = datetime.now() - timedelta(seconds=random.random() * 14 * 86400)
    cur.execute('INSERT INTO plant_location_history(plant_uuid,gid,position_id,moved_at,recorded_by,source,session_id) VALUES (%s,%s,%s,%s,%s,"web","S-DEMO")', 
                (plant_uuid, gid, pos_id, moved_at, admin_id))

conn.commit()
print(f'Inserted plants and history')

# Mark some plants as removed
cur.execute('SELECT uuid, current_position_id FROM plants ORDER BY RAND() LIMIT 15')
for plant_uuid, pos_id in cur.fetchall():
    cur.execute('INSERT INTO plant_status_history(plant_uuid,from_status,to_status,last_position_id,reason,recorded_by) VALUES (%s,"active","removed",%s,"Demo: removed from programme",%s)', 
                (plant_uuid, pos_id, admin_id))
    cur.execute('UPDATE plants SET status="removed", current_position_id=NULL WHERE uuid=%s', (plant_uuid,))

conn.commit()
print(f'Marked some plants as removed')

cur.close()
conn.close()
print('Demo data populated successfully!')
