# Morning Goblin personality refresh — 2026-10-24

Purpose: give the server a new season of jokes, occasional wildly nonsensical surprises, and one lightweight reason to talk to each other.

## Content

Fresh check-ins, duplicate replies, nudges, late rejections, mentions, generic conversation, topic replies, reminders, shiny rewards, quests, streaks, and office titles were reviewed and refreshed. Chaos received its own new banks. Help and preference replies stay actionable; late GMs still clearly explain rejection and keep the server's Jak joke. Classic keeps its recognizable season, and previous fresh/chaos banks are archived in the config.

The new fresh season includes 76 check-in replies, 45 mention replies, 50 generic replies, 28 reminders, 14 conversation topics, 32 micro-quests, and 36 weekly titles. Presence, outage, noon recap, random-callout, stream-status, record, and champion text also received new material. The rotating presence bank contains 46 statuses.

Examples:

- “gm logged. your bed is telling everyone this is just a phase.”
- “logged. you have completed the part of today that has instructions.”
- “i understand every word individually. the group project is where you've lost me.”
- “THE MOON IS A LANDLORD AND I HAVE EATEN THE LEASE.”
- “the lasagna has requested a horse. we are not asking follow-up questions.”

The last two come from a 40-line surreal bank. It has a 3.5% chance on eligible replies, with a persisted 30-minute server cooldown. It replaces the normal base line, preserves check-in confirmation/follow-ups, and adds no message or reward. Specific topic/help responses and quiet/silence preferences take priority.

## Break-room Referendum

`!gm dilemma` opens today's ridiculous two-choice reaction ballot. Subsequent requests link to the same ballot, including after a restart. There are 32 prompts, such as choosing between a goose with admin permissions and a very polite raccoon with a spreadsheet to run the server.

The noon recap has a 40% chance to include the day's ballot within its existing message, provided there is room and nobody has opened it already. A recap cannot reroll the decision on retries. The feature uses Discord reactions for informal voting; it does not track formal single-choice votes, alter scores, or create a new schedule.

The selected prompt is saved before sending. Its original message/channel is saved before adding reactions. Blocked sends retain the same choice for retry, and reaction failures preserve the original link. A deleted ballot leaves that day's link unavailable; the next local calendar day starts a new one.

## Factual bank review

The 20 existing morning facts were retained after review rather than mixed with fictional claims. Relevant primary references include [NIGMS on circadian rhythms](https://www.nigms.nih.gov/education/fact-sheets/Pages/circadian-rhythms), [NIOSH on caffeine](https://archive.cdc.gov/www_cdc_gov/niosh/emres/longhourstraining/caffeine.html/), [NIOSH on sleep inertia](https://www.cdc.gov/niosh/work-hour-training-for-nurses/longhours/mod7/03.html), [NASA on Martian sunrise and sunset](https://science.nasa.gov/solar-system/planets/mars/what-does-a-sunrise-sunset-look-like-on-mars/), [USNO on sunrise and solstices](https://aa.usno.navy.mil/faq/rs_solstices), and [the original rooster circadian-clock study](https://pubmed.ncbi.nlm.nih.gov/23518050/).

## Validation

- All 58 tests pass, including real-handler offline coverage of manual ballots, recap ballots, help/silence precedence, quiet check-ins, rare-reply cooldowns, and blocked sends.
- New focused tests cover ballot consistency after serialization/restart, failed saves, unavailable reactions, once-per-day recap selection, daily rollover, and unchanged points.
- Runtime config validation rejects invalid probabilities, negative cooldowns, malformed prompts, identical choices, and fields over 200 characters.
- JavaScript syntax checks and `git diff --check` passed. Content checks found no duplicate lines within active banks, unexpected placeholders, or raw user/broadcast pings. Presence names fit Discord's limit; the longest formatted ballot is 233 characters.
- No new dependency or additional timer. Existing attendance, shiny rewards, voice switching, preferences, and outbound-posting rules remain in place.

## Deployment

Posted the requested departure and return notices in the configured live morning channel, then verified the new process's Discord readiness, scheduler tick, and healthy watchdog result. The runtime error log is empty. The return notice introduces `!gm dilemma` so the server can discover it.

Compared saved state across the restart: both guilds and all 257 ledger filings are preserved, with identical scores, streaks, records, preferences, voice selections, channel settings, and timezones. Private config/state snapshots and message receipts are retained under `data/backups/freshness-2026-10-24/`, outside Git. Behavior tests use offline fake Discord channels; live checks verify deployment/connectivity without posting test ballots to the server.
