# Thread Decisions

Last updated: 2026-03-12

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
