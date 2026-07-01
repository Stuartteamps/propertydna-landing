/**
 * _internal_addr — shared guard so no sender ever mails our own synthetic rows.
 *
 * The accuracy back-test and the health-check monitor seed hundreds of
 * `backtest+NNNN@thepropertydna.com` / `healthcheck+NNNN@thepropertydna.com`
 * rows into property_reports. Our domain has a catch-all that forwards to Dan,
 * so mailing any of them floods his inbox and pollutes engagement metrics.
 * Real leads never use @thepropertydna.com — so treat the whole domain, plus
 * any +backtest/+healthcheck/+test tag on any domain, as non-mailable.
 */
function isInternalAddress(email) {
  const e = String(email || "").toLowerCase().trim();
  if (!e) return true; // empty/garbage — never send
  return /@thepropertydna\.com$/.test(e) || /\+(backtest|healthcheck|test)\b/.test(e);
}

module.exports = { isInternalAddress };
