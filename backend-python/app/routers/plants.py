import re
import json
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query

from .. import phenomeone
from ..auth import current_user, require
from ..db import audit, q, q1, tx
from ..schemas import Correction, NewGenotype, NewPlants, RemovePlant, Scan

router = APIRouter(tags=["plants"])


# ---------- search and detail ----------
@router.get("/plants")
def search_plants(term: str = Query("", alias="q"), _=Depends(current_user)):
    t = re.sub(r"[%_\\]", "", term).strip()
    if not t:
        return []
    like = f"%{t}%"
    return q("""select uuid, gid, status, sown_date, current_position_id as position from plants
                where uuid::text ilike %s or gid ilike %s or current_position_id ilike %s
                order by status, gid, current_position_id limit 50""", (like, like, like))


@router.get("/plants/{plant_uuid}")
def plant_detail(plant_uuid: UUID, _=Depends(current_user)):
    pl = q1("""select pl.uuid, pl.gid, pl.status, pl.sown_date, pl.created_at, pl.current_position_id as position,
                      (current_date - pl.sown_date) as age_days, g.phenomeone_id, g.info, g.phenomeone_synced_at, u.name as created_by
               from plants pl join genotypes g on g.gid = pl.gid left join users u on u.id = pl.created_by where pl.uuid = %s""", (plant_uuid,))
    if not pl:
        raise HTTPException(404, "Plant not found")
    history = q("""select h.id, h.position_id, h.moved_at, h.source, h.device, h.kind, h.reason, h.session_id, u.name as "by"
                   from plant_location_history h join users u on u.id = h.recorded_by
                   where h.plant_uuid = %s order by h.moved_at desc, h.id desc""", (plant_uuid,))
    status_history = q("""select s.at, s.from_status, s.to_status, s.last_position_id, s.reason, u.name as "by"
                          from plant_status_history s join users u on u.id = s.recorded_by where s.plant_uuid = %s order by s.at desc""", (plant_uuid,))
    return {"plant": pl, "history": history, "status_history": status_history}


# ---------- register / remove / correct ----------
@router.post("/plants", status_code=201)
def register_plants(b: NewPlants, user=Depends(require("admin", "breeder"))):
    if not q1("select 1 from genotypes where gid=%s", (b.gid,)):
        raise HTTPException(400, f"Unknown GID {b.gid}. Add the genotype first.")
    import uuid as uuid_lib
    rows = []
    with tx() as c:
        with c.cursor() as cur:
            for _ in range(b.count):
                plant_uuid = str(uuid_lib.uuid4())
                cur.execute("insert into plants(uuid,gid,sown_date,created_by) values (%s,%s,%s,%s)", 
                          (plant_uuid, b.gid, b.sown_date, user["id"]))
                rows.append({"uuid": plant_uuid, "gid": b.gid, "sown_date": b.sown_date.isoformat() if b.sown_date else None})
        audit(c, user["id"], "plant.create", b.gid, None, {"count": b.count})
    return rows


@router.post("/plants/{plant_uuid}/remove")
def remove_plant(plant_uuid: UUID, b: RemovePlant, user=Depends(require("admin", "manager", "breeder"))):
    with tx() as c:
        with c.cursor() as cur:
            cur.execute("select * from plants where uuid=%s for update", (plant_uuid,))
            pl = cur.fetchone()
        if not pl:
            raise HTTPException(404, "Plant not found")
        if pl["status"] == "removed":
            raise HTTPException(409, "Plant is already removed")
        with c.cursor() as cur:
            cur.execute("insert into plant_status_history(plant_uuid,from_status,to_status,last_position_id,reason,recorded_by) values (%s,'active','removed',%s,%s,%s)",
                      (plant_uuid, pl["current_position_id"], b.reason, user["id"]))
            cur.execute("update plants set status='removed', current_position_id=null where uuid=%s", (plant_uuid,))
        audit(c, user["id"], "plant.remove", str(plant_uuid), {"position": pl["current_position_id"]}, {"status": "removed", "reason": b.reason})
    return {"ok": True}


def move_plant(c, user, pid, plant_uuid, *, kind="scan", reason=None, session_id=None, source="web", device=None):
    """The one place a plant changes position. Validates, then writes history + current position."""
    with c.cursor() as cur:
        cur.execute("select 1 from positions where position_id=%s and status='active'", (pid,))
        if not cur.fetchone():
            raise HTTPException(400, f"Invalid position {pid}")
        cur.execute("select * from plants where uuid=%s for update", (plant_uuid,))
        pl = cur.fetchone()
    if not pl:
        raise HTTPException(400, "Unknown plant UUID")
    if pl["status"] != "active":
        raise HTTPException(400, "This plant has been removed")
    if pl["current_position_id"] == pid:
        raise HTTPException(409, "Plant is already at this position")
    with c.cursor() as cur:
        cur.execute("select uuid from plants where current_position_id=%s and status='active'", (pid,))
        occ = cur.fetchone()
    if occ:
        raise HTTPException(409, f"{pid} already holds plant {str(occ['uuid'])[:8]}…")
    with c.cursor() as cur:
        cur.execute("""insert into plant_location_history(plant_uuid,gid,position_id,recorded_by,source,session_id,kind,reason,device)
                     values (%s,%s,%s,%s,%s,%s,%s,%s,%s)""", (pl["uuid"], pl["gid"], pid, user["id"], source, session_id, kind, reason, device))
        cur.execute("update plants set current_position_id=%s where uuid=%s", (pid, plant_uuid))
    audit(c, user["id"], "plant.move" if kind == "scan" else "plant.correction", str(pl["uuid"]),
          {"position": pl["current_position_id"]}, {"position": pid, "reason": reason})
    return pl


@router.post("/plants/{plant_uuid}/correction")
def correct_location(plant_uuid: UUID, b: Correction, user=Depends(require("admin", "manager"))):
    """Manual correction: recorded as a new history row with a reason, never an overwrite."""
    with tx() as c:
        pl = move_plant(c, user, b.position_id.strip().upper(), plant_uuid, kind="correction", reason=b.reason)
    return {"message": f"{pl['gid']} corrected to {b.position_id.strip().upper()}"}


# ---------- scans ----------
@router.post("/scans", status_code=201)
def record_scan(b: Scan, user=Depends(require("admin", "manager", "breeder", "gardener"))):
    pid = b.position_id.strip().upper()
    try:
        with tx() as c:
            if b.session_id:
                c.execute("insert into scan_sessions(id,user_id,source,device) values (%s,%s,%s,%s) on conflict (id) do nothing",
                          (b.session_id, user["id"], b.source, b.device))
            pl = move_plant(c, user, pid, b.plant_uuid, session_id=b.session_id, source=b.source, device=b.device)
            if b.session_id:
                c.execute("update scan_sessions set last_scan_at = now() where id = %s", (b.session_id,))
    except HTTPException as e:
        if e.status_code in (400, 409):  # keep a record of rejected scans (shown as conflicts on the map)
            with tx() as c:
                c.execute("insert into scan_rejections(user_id,position_id,plant_uuid,reason,session_id,source) values (%s,%s,%s,%s,%s,%s)",
                          (user["id"], pid, str(b.plant_uuid), e.detail, b.session_id, b.source))
        raise
    return {"message": f"{pl['gid']} → {pid}"}


# ---------- genotypes (GID) ----------
@router.get("/genotypes")
def list_genotypes(term: str = Query("", alias="q"), _=Depends(current_user)):
    t = re.sub(r"[%_\\]", "", term).strip()
    return q("""select g.gid, g.phenomeone_id, g.status, g.phenomeone_synced_at,
                       sum(case when pl.status='active' then 1 else 0 end) as active_plants, count(pl.uuid) as total_plants
                from genotypes g left join plants pl on pl.gid = g.gid
                where g.gid ilike %s group by g.gid order by g.gid limit 100""", (f"%{t}%",))


@router.post("/genotypes", status_code=201)
def add_genotype(b: NewGenotype, user=Depends(require("admin", "breeder"))):
    with tx() as c:
        c.execute("insert into genotypes(gid,phenomeone_id,info) values (%s,%s,%s)", (b.gid, b.phenomeone_id, json.dumps(b.info)))
        audit(c, user["id"], "genotype.create", b.gid, None, {"phenomeone_id": b.phenomeone_id})
    return {"ok": True}


@router.get("/genotypes/{gid}")
def genotype(gid: str, _=Depends(current_user)):
    g = q1("select gid, phenomeone_id, info, status, phenomeone_synced_at from genotypes where gid=%s", (gid,))
    if not g:
        raise HTTPException(404, "Unknown GID")
    plants = q("""select pl.uuid, pl.status, pl.sown_date, (current_date - pl.sown_date) as age_days, pl.current_position_id as position,
                         p.glasshouse_code as glasshouse, p.platform_no as platform, p.column_no as "column", p.row_no as "row"
                  from plants pl left join positions p on p.position_id = pl.current_position_id
                  where pl.gid = %s order by pl.status, pl.current_position_id""", (gid,))
    return {"genotype": g, "plants": plants, "phenomeone_configured": phenomeone.configured()}


@router.post("/genotypes/{gid}/sync")
def sync_genotype(gid: str, user=Depends(require("admin", "breeder"))):
    if not q1("select 1 from genotypes where gid=%s", (gid,)):
        raise HTTPException(404, "Unknown GID")
    try:
        data = phenomeone.fetch(gid)
    except phenomeone.NotConfigured:
        raise HTTPException(503, "PhenomeOne is not configured on the server yet")
    except Exception:
        raise HTTPException(502, "PhenomeOne request failed")
    with tx() as c:
        c.execute("update genotypes set info=%s, phenomeone_synced_at=now() where gid=%s", (json.dumps(data), gid))
        audit(c, user["id"], "genotype.sync", gid)
    return {"ok": True}
