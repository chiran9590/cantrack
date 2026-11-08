from app.db import get_connection, tx
import uuid
from datetime import datetime, timedelta
import random

conn = get_connection()
with tx() as c:
    admin_id = 1
    c.execute('SELECT position_id FROM positions LIMIT 50')
    positions = c.fetchall()
    
    for pos in positions[:30]:
        gid = f'GT-{random.randint(1000, 1039)}'
        plant_uuid = str(uuid.uuid4())
        sown_date = datetime.now() - timedelta(days=random.randint(40, 160))
        c.execute('INSERT INTO plants(uuid, gid, sown_date, current_position_id, created_by) VALUES (%s, %s, %s, %s, %s)',
                  (plant_uuid, gid, sown_date.date(), pos['position_id'], admin_id))
    
    c.execute('INSERT INTO scan_sessions(id, user_id, source) VALUES (%s, %s, %s)', ('S-DEMO', admin_id, 'web'))
    
    c.execute('SELECT uuid, gid, current_position_id FROM plants')
    plants = c.fetchall()
    for plant in plants:
        moved_at = datetime.now() - timedelta(seconds=random.random() * 14 * 86400)
        c.execute('INSERT INTO plant_location_history(plant_uuid, gid, position_id, moved_at, recorded_by, source, session_id) VALUES (%s, %s, %s, %s, %s, %s, %s)',
                  (plant['uuid'], plant['gid'], plant['current_position_id'], moved_at, admin_id, 'web', 'S-DEMO'))
    
    print('Created 30 plants')
conn.close()
