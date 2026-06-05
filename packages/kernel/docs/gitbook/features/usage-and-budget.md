# Usage & Budget

## Token tracking

Every time an agent completes a prompt, Viben records a usage entry containing the session ID, timestamp, number of tokens consumed, and cost in USD (if the agent reports it). These records are stored in `<instance-root>/usage.json`.

You can query usage summaries for different time periods:

| Period | Covers |
|--------|--------|
| `today` | From midnight local time to now |
| `week` | Rolling 7-day window |
| `month` | Current calendar month (1st of month to now) |
| `all` | All records within the retention window |

Each summary includes total tokens, total cost, number of distinct sessions, and the record count.

---

## Monthly budget

Set a spending limit in the instance `config.json`:

```json
{
  "usage": {
    "monthlyBudget": 20.00,
    "warningThreshold": 0.8
  }
}
```

| Field | Default | Description |
|-------|---------|-------------|
| `monthlyBudget` | none | Monthly spending limit in USD. Leave unset to disable budget checking. |
| `warningThreshold` | `0.8` | Fraction of the budget at which to send a warning (0.8 = 80%) |

---

## Warning and exceeded notifications

When a session completes and usage crosses a threshold, Viben sends a notification to your connected platform (Telegram or Discord):

- **Warning** — sent once when monthly cost reaches `warningThreshold * monthlyBudget`. Shows a progress bar and current percentage.
- **Exceeded** — sent once when monthly cost reaches or exceeds `monthlyBudget`. Includes a note that sessions are **not blocked** — this is a soft limit only.

Notifications are de-duplicated: the same status level is not sent again within the same calendar month. At the start of a new month the counter resets automatically.

Example notification:

```
⚠️ Budget Warning
Monthly usage: $16.32 / $20.00 (82%)
▓▓▓▓▓▓▓▓░░ 82%
```

---

## Retention

Usage records older than the configured retention period are deleted automatically. The default is **90 days**.

To configure retention:

```json
{
  "usage": {
    "retentionDays": 90
  }
}
```

---

## Technical details

Usage data is stored in `<instance-root>/usage.json`. Writes are batched to avoid excessive disk I/O. The file is saved on process exit to prevent data loss. If the file is corrupt on startup, Viben saves a backup and starts fresh.
