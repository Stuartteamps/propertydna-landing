#!/usr/bin/env node
/**
 * indexes-refresh.js — lightweight top-up of the Coachella Valley index.
 *
 * Same real ingest path as indexes-build.js (POST ingest-rivco-parcels with
 * x-internal-key for every CV city), but with a smaller target and a tighter
 * per-city invocation cap — meant for frequent incremental refreshes rather
 * than a full backfill. Delegates to runIngest() in indexes-build.js so there
 * is a single source of truth for the ingest loop.
 *
 * Prints written/existing per city and a grand total. Never fakes writes.
 */
"use strict";

const { main } = require("./indexes-build");

// Smaller target + fewer invocations than a full build.
main({ target: 500, maxInvocationsPerCity: 2, label: "refresh" });
