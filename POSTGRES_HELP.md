# "I forgot my Postgres root user and password"

You do not need one. The app only needs its **own** database user, and you can create it yourself. Three ways out, easiest first.

## 1. Skip local Postgres: use Neon (free)
Put a Neon connection string in `backend-python/.env` as `DATABASE_URL`. Nothing else to install, and the same database works on your laptop and after deployment.

## 2. Your Mac has Homebrew Postgres (your `logfile` says PostgreSQL 16 from Homebrew)
Homebrew creates **no `postgres` user and no password**. The superuser is your Mac username (`chiran`) and local connections are trusted, so:
```
brew services list                       # postgresql@16 should say "started"
psql postgres                            # note: NOT "psql -U postgres"; that user does not exist on Homebrew installs
```
If `psql: command not found`:  `/opt/homebrew/opt/postgresql@16/bin/psql postgres`

Then create the app's own login:
```
create role cantrack login password 'choose-a-password';
create database cantrack owner cantrack;
\q
```
`DATABASE_URL=postgresql://cantrack:choose-a-password@localhost:5432/cantrack`, then `python -m app.check_db`.

Your log also shows "Address already in use": two Postgres servers tried to use port 5432. Check with `lsof -i :5432`; keep one (`brew services stop postgresql@16` stops the Homebrew one if you use Postgres.app or Docker instead).

## 3. It asks for a password you really don't know (any install)
1. Find the config: Homebrew `/opt/homebrew/var/postgresql@16/pg_hba.conf` · Postgres.app `~/Library/Application Support/Postgres/var-16/pg_hba.conf` · EDB installer `/Library/PostgreSQL/16/data/pg_hba.conf`
2. Open it and change the METHOD at the end of the `127.0.0.1/32` and `::1/128` lines (and the `local` line) from `scram-sha-256` / `md5` to `trust`. Save.
3. Restart: `brew services restart postgresql@16` (Postgres.app: Stop/Start; EDB: `sudo launchctl` or the Postgres menu).
4. `psql -U postgres -h 127.0.0.1` (EDB/others) or `psql postgres` (Homebrew), then:  `alter role postgres password 'new-password';`  (Homebrew: `alter role chiran password 'new-password';`)
5. Put the file back to `scram-sha-256` and restart again. Do not leave `trust` on.

Then still create the dedicated `cantrack` user from section 2, and do not use the superuser in `DATABASE_URL`.

## Quick tester
`cd backend-python && python -m app.check_db` prints which user/host it tried (never the password) and the usual cause if it fails.
