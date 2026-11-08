import csv
import io
from datetime import date, datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from openpyxl import Workbook

from ..auth import require
from ..db import query

router = APIRouter(tags=["reports"])

# Every report accepts the same optional filters; a NULL filter means "no filter".
GH = "(%(gh)s is null or {c} = %(gh)s)"
PL = "(%(platform)s is null or {c} = %(platform)s)"
FROM = "(%(date_from)s is null or {c} >= %(date_from)s)"
TO = "(%(date_to)s is null or {c} < (%(date_to)s::date + 1))"
USER = "(%(user_id)s is null or {c} = %(user_id)s)"
GID = "(%(gid)s is null or {c} like %(gid)s)"


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
        and (%(status)s is null or pl.status = %(status)s)
      order by pl.gid, pl.current_position_id limit 20000""",
    "movements": f"""select h.moved_at, h.plant_uuid::text as plant_uuid, h.gid, h.position_id, p.glasshouse_code as glasshouse,
        p.platform_no as platform, h.kind, h.reason, h.source, h.device, h.session_id, u.name as recorded_by
      from plant_location_history h join positions p on p.position_id = h.position_id join users u on u.id = h.recorded_by
      where {HIST} order by h.moved_at desc limit 20000""",
    "moved": f"""select h.plant_uuid::text as plant_uuid, h.gid, count(*) as movements, min(h.moved_at) as first_move,
        max(h.moved_at) as last_move, (select position_id from plant_location_history h2 where h2.plant_uuid = h.plant_uuid order by h2.moved_at desc, h2.id desc limit 1) as latest_position
      from plant_location_history h join positions p on p.position_id = h.position_id
      where {HIST} group by h.plant_uuid, h.gid order by movements desc limit 20000""",
    "positions": f"""select p.position_id, p.glasshouse_code as glasshouse, p.platform_no as platform, p.column_no as "column",
        p.row_no as "row", {STATE} as state, pl.uuid::text as plant_uuid, pl.gid
      from positions p left join plants pl on pl.current_position_id = p.position_id and pl.status = 'active'
      where {f(GH, 'p.glasshouse_code')} and {f(PL, 'p.platform_no')} and {f(GID, 'pl.gid')}
        and (%(state)s is null or {STATE} = %(state)s)
      order by p.position_id limit 20000""",
    "occupancy": f"""select p.glasshouse_code as glasshouse, p.platform_no as platform, count(*) as positions,
        count(pl.uuid) as occupied, (count(*) - count(pl.uuid)) as empty,
        round(100.0 * count(pl.uuid) / count(*), 1) as occupancy_pct
      from positions p left join plants pl on pl.current_position_id = p.position_id and pl.status = 'active'
      where {f(GH, 'p.glasshouse_code')} and {f(PL, 'p.platform_no')}
      group by p.glasshouse_code, p.platform_no order by 1, 2""",
    "scanning": f"""select date(h.moved_at) as d, u.name as "user", count(*) as scans,
          count(distinct h.plant_uuid) as plants, count(distinct h.session_id) as sessions, 0 as rejected
        from plant_location_history h join users u on u.id = h.recorded_by
        where {f(FROM, 'h.moved_at')} and {f(TO, 'h.moved_at')} and {f(USER, 'h.recorded_by')}
        group by date(h.moved_at), u.name
      union all
      select date(x.at) as d, u.name as "user", 0 as scans, 0 as plants, 0 as sessions, count(*) as rejected
        from scan_rejections x left join users u on u.id = x.user_id
        where {f(FROM, 'x.at')} and {f(TO, 'x.at')} and {f(USER, 'x.user_id')}
        group by date(x.at), u.name
      order by d desc, "user"
""",
    "sessions": f"""select s.id as session_id, u.name as "user", s.source, s.device, s.started_at, s.last_scan_at, count(h.id) as scans
      from scan_sessions s join users u on u.id = s.user_id left join plant_location_history h on h.session_id = s.id
      where {f(FROM, 's.started_at')} and {f(TO, 's.started_at')} and {f(USER, 's.user_id')}
      group by s.id, u.name order by s.started_at desc limit 20000""",
    "rejections": f"""select r.at, u.name as "user", r.position_id, r.plant_uuid, r.reason, r.session_id, r.source
      from scan_rejections r left join users u on u.id = r.user_id
      where {f(FROM, 'r.at')} and {f(TO, 'r.at')} and {f(USER, 'r.user_id')} order by r.at desc limit 20000""",
    "audit": f"""select a.at, u.name as actor, a.action, a.target, a.before_value::text as before_value, a.after_value::text as after_value
      from audit_log a left join users u on u.id = a.actor_id
      where {f(FROM, 'a.at')} and {f(TO, 'a.at')} and {f(USER, 'a.actor_id')} order by a.at desc limit 20000""",
    "turnover": f"""select glasshouse, month, sum(new_plants)::int as new_plants, sum(movements)::int as movements,
        sum(unique_plants)::int as unique_plants, sum(removed)::int as removed,
        round(sum(movements)::numeric / nullif(sum(unique_plants), 0), 2) as position_changes_per_plant
      from (
        select h.glasshouse_code as glasshouse, to_char(h.moved_at, 'YYYY-MM') as month,
          count(distinct case when h.rn = 1 then h.plant_uuid end) as new_plants, count(*) as movements,
          count(distinct h.plant_uuid) as unique_plants, 0 as removed
        from (select h.*, p.glasshouse_code, row_number() over (partition by h.plant_uuid order by h.moved_at, h.id) as rn
              from plant_location_history h join positions p on p.position_id = h.position_id) h
        where {f(GH, 'h.glasshouse_code')} and {f(FROM, 'h.moved_at')} and {f(TO, 'h.moved_at')}
        group by h.glasshouse_code, to_char(h.moved_at, 'YYYY-MM')
        union all
        select p.glasshouse_code, to_char(s.at, 'YYYY-MM'), 0, 0, 0, count(*)
        from plant_status_history s join positions p on p.position_id = s.last_position_id
        where s.to_status = 'removed' and {f(GH, 'p.glasshouse_code')} and {f(FROM, 's.at')} and {f(TO, 's.at')}
        group by p.glasshouse_code, to_char(s.at, 'YYYY-MM')
      ) t group by glasshouse, month order by month desc, glasshouse""",
}


def _x(v):
    if isinstance(v, datetime):
        return v.replace(tzinfo=None)
    if isinstance(v, Decimal):
        return float(v)
    return v if v is None or isinstance(v, (int, float, str, bool, date)) else str(v)  # UUID, dict (jsonb), ... -> text


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
    cols, rows = query(sql, params)
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
