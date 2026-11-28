# Load test results

How much the database works during a live class, measured with the load test
(GitHub → Actions → "Load test" → Run workflow). Use it to judge whether a
big group is safe on the Supabase free plan.

## 28 Nov 2026: 50 phones (after all fixes)

One session: 50 pretend students join over 30 s, play 3 speed-friending
rounds and a word game (150 "Got it" taps). About 2.5 minutes.

| What | Result |
| --- | --- |
| Joined | 50 of 50, about 0.5 s each |
| Teacher's changes reaching phones | 0.3 s (all live) |
| Taps reaching the teacher | 0.27 s (all live) |
| Requests to Supabase | 4,024 (about 29 a second), 0 errors |
| Database transactions | about 4,900 |
| Disk reads | 32 blocks (about 0.25 MB) |
| Disk writes | 0 (everything fitted in memory) |
| Change log written (WAL) | about 0.5 MB |

**What this means:** a 50-student session hardly touches the disk. A real
assembly runs longer (say 15 minutes, so about 6 times these numbers), which is
still small.

## 27 Nov 2026: what went wrong

Six 100-phone runs close together, with an older version of the app that kept
asking every 2 seconds even when the server was slow, overloaded the free-plan
database. It was slow or unreachable from about 6:10 PM to 9 PM, and Supabase
reported the disk I/O budget used up. Fixed since then: phones back off when
the server is slow (`SLOW_SERVER_MAX_WAIT_MS` in `src/core/live/use-live-session.ts`).

## Rules of thumb

- Up to 50 students in one session: fine on the free plan.
- 100 students, or several classes at the same time: upgrade to Supabase Pro first.
- Don't run load tests back to back, or on the day of an event.
- Supabase's own graph: Dashboard → Reports → Database → "Disk IO % consumed".

## How to measure again

Before and after a test, run this in the SQL editor and subtract:

```sql
select now(),
  (select sum(reads) from pg_stat_io) as disk_reads,
  (select sum(writes) from pg_stat_io) as disk_writes,
  (select wal_bytes from pg_stat_wal) as wal_bytes,
  (select sum(xact_commit) from pg_stat_database) as transactions;
```

Then delete the test data with `supabase/load-test-cleanup.sql`.
