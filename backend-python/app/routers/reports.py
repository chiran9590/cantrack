import csv
import io
from datetime import date, datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from openpyxl import Workbook

from ..auth import require
from ..db import pool

router = APIRouter(tags=["reports"])

# Every report accepts the same optional filters; a NULL filter means "no filter".
GH = "(%(gh)s::text is null or {c} = %(gh)s)"
PL = "(%(platform)s::int is null or {c} = %(platform)s)"
FROM = "(%(date_from)s::date is null or {c} >= %(date_from)s::date)"
TO = "(%(date_to)s::date is null or {c} < (%(date_to)s::date + 1))"
USER = "(%(user_id)s::int is null or {c} = %(user_id)s)"
GID = "(%(gid)s::text is null or {c} ilike %(gid)s)"


def f(frag: str, col: str) -> str:
    return frag.format(c=col)


HIST = f"""{f(GH, 'p.glasshouse_code')} and {f(PL, 'p.platform_no')} and {f(GID, 'h.gid')}
          and {f(FROM, 'h.moved_at')} and {f(TO, 'h.moved_at')} and {f(USER, 'h.recorded_by')}"""
STATE = "case when pl.uuid is null then 'empty' else 'occupied' end"

REPORTS: dict[str, str] = {
    "plants": f"""select pl.uuid::text as plant_uuid, pl.gid, pl.status, pl.sown_date, (current_date - pl.sown_date) as age_days,
        pl.current_position_id as position, p.glasshouse_code as glasshouse, p.platform_no as platform,
        p.column_no as "column", p.row_no as "row", pl.created_at
      from plants pl left join positions p on p.position_id = pl.current_position_id
      where {f(GH, 'p.glasshouse_code')} and {f(PL, 'p.platform_no')} and {f(GID, 'pl.gid')}
        and (%(status)s::text is null or pl.status = %(status)s)
      order by pl.gid, pl.current_position_id limit 20000""",
    "movements": f"""select h.moved_at, h.plant_uuid::text as plant_uuid, h.gid, h.position_id, p.glasshouse_code as glasshouse,
        p.platform_no as platform, h.kind, h.reason, h.source, h.device, h.session_id, u.name as recorded_by
      from plant_location_history h join positions p on p.position_id = h.position_id join users u on u.id = h.recorded_by
      where {HIST} order by h.moved_at desc limit 20000""",
    "moved": f"""select h.plant_uuid::text as plant_uuid, h.gid, count(*)::int as movements, min(h.moved_at) as first_move,
        max(h.moved_at) as last_move, (array_agg(h.position_id order by h.moved_at desc, h.id desc))[1] as latest_position
      from plant_location_history h join positions p on p.position_id = h.position_id
      where {HIST} group by h.plant_uuid, h.gid order by movements desc limit 20000""",
    "positions": f"""select p.position_id, p.glasshouse_code as glasshouse, p.platform_no as platform, p.column_no as "column",
        p.row_no as "row", {STATE} as state, pl.uuid::text as plant_uuid, pl.gid
      from positions p left join plants pl on pl.current_position_id = p.position_id and pl.status = 'active'
      where {f(GH, 'p.glasshouse_code')} and {f(PL, 'p.platform_no')} and {f(GID, 'pl.gid')}
        and (%(state)s::text is null or {STATE} = %(state)s)
      order by p.position_id limit 20000""",
    "occupancy": f"""select p.glasshouse_code as glasshouse, p.platform_no as platform, count(*)::int as positions,
        count(pl.uuid)::int as occupied, (count(*) - count(pl.uuid))::int as empty,
        round(100.0 * count(pl.uuid) / count(*), 1) as occupancy_pct
      from positions p left join plants pl on pl.current_position_id = p.position_id and pl.status = 'active'
      where {f(GH, 'p.glasshouse_code')} and {f(PL, 'p.platform_no')}
      group by p.glasshouse_code, p.platform_no order by 1, 2""",
    "scanning": f"""with s as (select recorded_by as uid, moved_at::date as d, count(*)::int as scans,
          count(distinct plant_uuid)::int as plants, count(distinct session_id)::int as sessions
        from plant_location_history h where {f(FROM, 'h.moved_at')} and {f(TO, 'h.moved_at')} and {f(USER, 'h.recorded_by')} group by 1, 2),
      r as (select user_id as uid, at::date as d, count(*)::int as rejected from scan_rejections x
        where {f(FROM, 'x.at')} and {f(TO, 'x.at')} and {f(USER, 'x.user_id')} group by 1, 2)
      select coalesce(s.d, r.d) as date, u.name as "user", coalesce(s.scans, 0) as scans, coalesce(s.plants, 0) as plants,
        coalesce(s.sessions, 0) as sessions, coalesce(r.rejected, 0) as rejected
      from s full join r on s.uid = r.uid and s.d = r.d join users u on u.id = coalesce(s.uid, r.uid)
      order by 1 desc, 2""",
    "sessions": f"""select s.id as session_id, u.name as "user", s.source, s.device, s.started_at, s.last_scan_at, count(h.id)::int as scans
      from scan_sessions s join users u on u.id = s.user_id left join plant_location_history h on h.session_id = s.id
      where {f(FROM, 's.started_at')} and {f(TO, 's.started_at')} and {f(USER, 's.user_id')}
      group by s.id, u.name order by s.started_at desc limit 20000""",
    "rejections": f"""select r.at, u.name as "user", r.position_id, r.plant_uuid, r.reason, r.session_id, r.source
      from scan_rejections r left join users u on u.id = r.user_id
      where {f(FROM, 'r.at')} and {f(TO, 'r.at')} and {f(USER, 'r.user_id')} order by r.at desc limit 20000""",
    "audit": f"""select a.at, u.name as actor, a.action, a.target, a.before_value::text as before_value, a.after_value::text as after_value
      from audit_log a left join users u on u.id = a.actor_id
      where {f(FROM, 'a.at')} and {f(TO, 'a.at')} and {f(USER, 'a.actor_id')} order by a.at desc limit 20000""",
    "turnover": f"""with m as (select p.glasshouse_code as gh, date_trunc('month', h.moved_at)::date as mon, h.plant_uuid,
          row_number() over (partition by h.plant_uuid order by h.moved_at, h.id) as rn
        from plant_location_history h join positions p on p.position_id = h.position_id),
      a as (select gh, mon, (count(*) filter (where rn = 1))::int as new_plants, count(*)::int as movements,
          count(distinct plant_uuid)::int as unique_plants
        from m where {f(GH, 'gh')} and {f(FROM, 'mon')} and {f(TO, 'mon')} group by gh, mon),
      r as (select p.glasshouse_code as gh, date_trunc('month', s.at)::date as mon, count(*)::int as removed
        from plant_status_history s join positions p on p.position_id = s.last_position_id
        where s.to_status = 'removed' and {f(GH, 'p.glasshouse_code')} and {f(FROM, 's.at')} and {f(TO, 's.at')} group by 1, 2)
      select coalesce(a.gh, r.gh) as glasshouse, to_char(coalesce(a.mon, r.mon), 'YYYY-MM') as month,
        coalesce(a.new_plants, 0) as new_plants, coalesce(r.removed, 0) as removed, coalesce(a.movements, 0) as movements,
        coalesce(a.unique_plants, 0) as unique_plants,
        round(coalesce(a.movements, 0)::numeric / nullif(a.unique_plants, 0), 2) as position_changes_per_plant
      from a full join r on a.gh = r.gh and a.mon = r.mon order by 2 desc, 1""",
}


def _x(v):
    if isinstance(v, datetime):
        return v.replace(tzinfo=None)
    if isinstance(v, Decimal):
        return float(v)
    return v if v is None or isinstance(v, (int, float, str, bool, date)) else str(v)


@router.get("/reports")
def list_reports(_=Depends(require("admin", "manager", "breeder"))):
    return list(REPORTS)


@router.get("/reports/{name}")
def report(name: str, fmt: str = Query("json", alias="format", pattern="^(json|csv|xlsx)$"),
           glasshouse: str | None = None, platform: int | None = None, gid: str | None = None, status: str | None = None,
           state: str | None = None, date_from: date | None = None, date_to: date | None = None, user_id: int | None = None,
           _=Depends(require("admin", "manager", "breeder"))):
    sql = REPORTS.get(name)
    if not sql:
        raise HTTPException(404, "Unknown report")
    params = {"gh": glasshouse.upper() if glasshouse else None, "platform": platform,
              "gid": f"%{gid.strip()}%" if gid and gid.strip() else None, "status": status or None, "state": state or None,
              "date_from": date_from, "date_to": date_to, "user_id": user_id}
    with pool.connection() as c:
        cur = c.execute(sql, params)
        cols = [d.name for d in cur.description]
        rows = cur.fetchall()
    if fmt == "json":
        return {"columns": cols, "rows": rows[:200], "total": len(rows)}
    fname = f"cantrack_{name}_{date.today().isoformat()}.{fmt}"
    head = {"Content-Disposition": f'attachment; filename="{fname}"'}
    if fmt == "csv":
        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(cols)
        for r in rows:
            w.writerow(["" if r[k] is None else r[k] for k in cols])
        return Response(("\ufeff" + buf.getvalue()).encode("utf-8"), media_type="text/csv; charset=utf-8", headers=head)
    wb = Workbook()
    ws = wb.active
    ws.title = name[:31]
    ws.append(cols)
    for r in rows:
        ws.append([_x(r[k]) for k in cols])
    out = io.BytesIO()
    wb.save(out)
    return Response(out.getvalue(), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers=head)
