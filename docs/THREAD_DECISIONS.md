# Thread Decisions

Last updated: 2026-07-13

This file captures key product decisions from the development thread that are easy to lose over time.

## Personality / tone

- The bot should feel funny, casual, dumb, and a little sarcastic.
- It should not feel formal or corporate unless that formality is part of the joke.
- Bureaucratic goblin / clipboard / dawn compliance humor is the core bit.

## User-facing behavior decisions

- No `@everyone` mass-pings in normal bot output.
- Direct mentions should feel responsive.
- Unrelated conversation should not trigger random bot chatter anymore.
- The bot should be customizable through config for phrases and text pools.
- The owner should be able to make the bot say arbitrary things.
- The owner should be able to do that from a hidden channel while posting publicly elsewhere.
- Those owner speech commands should not reply with a noisy success confirmation.
- The bot should auto-rotate through lots of short funny statuses every 6-12 hours.
- Owner-set presence should still override the rotation until reset.
- A planned temporary outage should be announcable with one owner-only command, and the goblin should only announce its return if that outage command was used first.
- The owner should be able to manually backfill a same-day check-in from an existing Discord message when needed.
- The owner should also have a separate command that retroactively reacts and replies on a good-morning message after logging it.
- The regular scheduled reminder should be easy to disable without deleting the logic entirely.
- The old 10:30 census should be replaced by a short noon Pacific recap instead of a wordier mid-morning post.
- The bot should randomly call out one person who has not said good morning yet each morning.
- First successful GMs should award points, with weekly/monthly/yearly champions declared automatically instead of manual scorekeeping.
- The bot should support switchable voice packs so old and new material can rotate without editing JSON live.
- Retired message pools should stay recoverable and can serve as the `classic` voice pack.
- Optional daily micro-quests should add small novelty without requiring users to answer them.
- First visible check-in replies may occasionally append rare shiny lines and award arbitrary bonus points.
- The bot should celebrate 3-day, 7-day, and comeback streaks without adding extra bot messages.
- The bot must never post twice in a row in one channel; every kind of send waits for another sender after the bot's latest post.
- Weekly champions should receive a silly saved office title.

## Greeting rules

- Normal variants like `gm`, `good morning gamers`, etc. should count.
- The inside joke `Mong Plorps` format should count through an `M... P...` regex pattern.
- A valid greeting only counts if it is still morning somewhere in the United States.
- If not, the bot should reject it and make a Jak/timezone joke.

## Quiet-list behavior

- Some users may find explicit check-in replies annoying.
- Those users should still be logged and still receive the sun reaction.
- Only the text reply should be suppressed.

## Record tracking

- The bot should remember best and worst good-morning days.
- A new best day should get a special celebration post and tag the contributors.

## Morning facts

- A random morning-facts command should exist.
- Facts should be true.
- Facts should preferably be positive, motivational, interesting, strange, or funny.
- Facts should rotate and avoid immediate repetition.

## Operational decisions

- The bot may eventually live on a Raspberry Pi.
- SSH push to GitHub is configured and working.
- A lock file should prevent duplicate bot processes from causing doubled replies.
