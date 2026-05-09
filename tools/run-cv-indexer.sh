#!/usr/bin/env bash
# run-cv-indexer.sh — Index all remaining Coachella Valley cities sequentially
# Calls the Netlify function in a loop until each city is done.
# Safe to kill and restart — picks up from kpi_events offset.
# Usage: bash tools/run-cv-indexer.sh [CITY]   (omit city to run all)

set -euo pipefail

ENDPOINT="https://thepropertydna.com/.netlify/functions/index-properties"
INTERNAL_KEY="271d07f203bc34ba8574988ac272ab15ac60c5dbf25dd9391403d54c6a7fd977"
BATCH=200
SLEEP_BETWEEN=1   # seconds between calls — avoids hammering ArcGIS
LOG="/Users/danstuart/propertydna-landing/tools/cv-indexer.log"

CITIES=("PALM SPRINGS" "PALM DESERT" "RANCHO MIRAGE" "INDIO" "CATHEDRAL CITY")

# If a city arg passed, only run that one
if [[ $# -gt 0 ]]; then
  CITIES=("$@")
fi

log() { echo "[$(date '+%H:%M:%S')] $*" | tee -a "$LOG"; }

index_city() {
  local CITY="$1"
  log "═══ Starting: $CITY ═══"

  local DONE="false"
  local CALLS=0
  local TOTAL_PROCESSED=0

  while [[ "$DONE" != "true" ]]; do
    RESPONSE=$(curl -sf -X POST "$ENDPOINT" \
      -H "x-internal-key: $INTERNAL_KEY" \
      -H "Content-Type: application/json" \
      -d "{\"city\":\"$CITY\",\"batchSize\":$BATCH}" \
      --max-time 30 2>/dev/null) || {
        log "  CURL ERROR — retrying in 10s..."
        sleep 10
        continue
      }

    PROCESSED=$(echo "$RESPONSE" | jq -r '.processed // 0')
    CITY_DONE=$(echo "$RESPONSE" | jq -r '.cityDone // false')
    OFFSET=$(echo "$RESPONSE" | jq -r '.newOffset // "?"')
    TOTAL=$(echo "$RESPONSE" | jq -r '.total // "?"')
    MSG=$(echo "$RESPONSE" | jq -r '.message // ""')
    ERR=$(echo "$RESPONSE" | jq -r '.error // ""')

    if [[ -n "$ERR" ]]; then
      log "  ERROR: $ERR — retrying in 15s..."
      sleep 15
      continue
    fi

    CALLS=$(( CALLS + 1 ))
    TOTAL_PROCESSED=$(( TOTAL_PROCESSED + PROCESSED ))

    log "  $MSG (call #$CALLS, +$PROCESSED this batch, $TOTAL_PROCESSED total)"

    if [[ "$CITY_DONE" == "true" ]]; then
      DONE="true"
      log "  ✅ $CITY COMPLETE — $TOTAL_PROCESSED rows indexed in $CALLS calls"
    elif [[ "$PROCESSED" -eq 0 ]]; then
      log "  ⚠ Empty batch at offset $OFFSET — ArcGIS may be slow, waiting 30s..."
      sleep 30
    else
      sleep "$SLEEP_BETWEEN"
    fi
  done
}

log "PropertyDNA CV Indexer starting — cities: ${CITIES[*]}"
log "Batch size: $BATCH | Endpoint: $ENDPOINT"
log "Log: $LOG"
echo ""

for CITY in "${CITIES[@]}"; do
  index_city "$CITY"
  echo ""
done

log "ALL CITIES COMPLETE"
