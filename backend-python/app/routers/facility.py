from fastapi import APIRouter, Depends, HTTPException

from ..auth import current_user, require
from ..db import audit, create_glasshouse, q, q1, tx
from ..schemas import NewHouse

router = APIRouter(tags=["facility"])

FACILITY_SQL = """
select g.code, g.name, g.description, g.num_platforms as platforms, g.num_columns as "columns", g.num_rows as "rows",
       count(p.position_id)::int as total, count(pl.uuid)::int as occupied
from glasshouses g
join positions p on p.glasshouse_code = g.code
left join plants pl on pl.current_position_id = p.position_id and pl.status = 'active'
where g.active group by g.code order by g.code"""


@router.get("/facility")
def facility(_=Depends(current_user)):
    return q(FACILITY_SQL)


@router.post("/glasshouses", status_code=201)
def add_house(b: NewHouse, admin=Depends(require("admin"))):
    with tx() as c:
        create_glasshouse(c, b.model_dump())
        audit(c, admin["id"], "glasshouse.create", b.code, None, b.model_dump())
    return {"ok": True}


@router.get("/dashboard")
def dashboard(_=Depends(current_user)):
    recent = q("""select h.id, h.gid, h.position_id, h.moved_at, h.source, h.kind, u.name as "by"
                  from plant_location_history h join users u on u.id = h.recorded_by order by h.moved_at desc limit 10""")
    stats = q1("""select (select count(*) from plants where status='active')::int as active_plants,
                         (select count(*) from plants where status='removed')::int as removed_plants,
                         (select count(*) from plant_location_history where moved_at >= current_date)::int as scans_today,
                         (select count(*) from scan_rejections where at >= current_date)::int as rejected_today""")
    return {"houses": q(FACILITY_SQL), "recent": recent, "stats": stats}


@router.get("/map/{code}/{platform}")
def glass_map(code: str, platform: int, _=Depends(current_user)):
    code = code.upper()
    cells = q("""select pl.current_position_id as position_id, pl.uuid, pl.gid from plants pl
                 join positions p on p.position_id = pl.current_position_id
                 where p.glasshouse_code = %s and p.platform_no = %s and pl.status = 'active'""", (code, platform))
    conflicts = q("""select distinct r.position_id from scan_rejections r join positions p on p.position_id = r.position_id
                     where p.glasshouse_code = %s and p.platform_no = %s and r.at > now() - interval '24 hours'""", (code, platform))
    return {"cells": cells, "conflicts": [x["position_id"] for x in conflicts]}


@router.get("/positions/{pid}")
def position(pid: str, _=Depends(current_user)):
    pid = pid.upper()
    if not q1("select 1 from positions where position_id=%s", (pid,)):
        raise HTTPException(404, "Position not found")
    plant = q1("""select pl.uuid, pl.gid, pl.sown_date, g.phenomeone_id, g.info from plants pl join genotypes g on g.gid = pl.gid
                  where pl.current_position_id = %s and pl.status = 'active'""", (pid,))
    history = q("""select h.id, h.position_id, h.moved_at, h.source, h.kind, h.reason, u.name as "by"
                   from plant_location_history h join users u on u.id = h.recorded_by
                   where h.plant_uuid = %s order by h.moved_at desc, h.id desc""", (plant["uuid"],)) if plant else []
    rejections = q("""select r.at, r.reason, u.name as "by" from scan_rejections r left join users u on u.id = r.user_id
                      where r.position_id = %s order by r.at desc limit 5""", (pid,))
    return {"position": pid, "plant": plant, "history": history, "rejections": rejections}
