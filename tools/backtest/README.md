# PropertyDNA Valuation Back-Test

Turns the unvalidated "97% accurate" marketing line into a **measured, defensible**
accuracy number you can quote in a listing appointment.

## Run it

```bash
node tools/backtest/run.js                      # uses tools/backtest/samples.csv
node tools/backtest/run.js path/to/data.csv     # any CSV
node tools/backtest/run.js data.csv --compute   # recompute predictions from raw inputs
```

It prints per-property error, **median absolute error** (the headline), the share
of homes within 5/10/20%, and **signed bias** (are we systematically high or low —
this is what catches issues like the old pool false-negative that biased us low).

`DEFENSIBLE ACCURACY = 100 − median absolute % error.`

## The CSV

Header row required. Start from `samples.example.csv`.

| column | required | meaning |
|---|---|---|
| `address` | – | label only |
| `actual_price` | ✅ | the **real sold price** = ground truth |
| `predicted_price` | ✅* | the PropertyDNA value you captured for that home |
| `raw_mid`, `last_sale_price`, `last_sale_date`, `market_yoy`, `pool`, `casita`, `gated`, `golf`, `mountain_view` | for `--compute` | raw inputs so the harness can recompute the prediction with production logic |

\* In default mode each row needs `predicted_price`. In `--compute` mode, rows
without a `predicted_price` are scored by recomputing it via the **same**
`computeDnaAdjustment()` the live pipeline uses — so you can test valuation-logic
changes (like the pool fix) against ground truth before shipping them.

## Methodology (be honest about this)

- **Ground truth is the actual sold price.** Nothing else.
- For a clean test, the prediction should be built from data available **before**
  the sale (point-in-time) — don't grade the model on the sale it's predicting.
- **Median** absolute error is the headline (robust to one weird outlier); mean
  error and the within-X% bands give the full shape.
- **Bias matters more than tightness.** A model centered at 0% bias that's ±8% is
  more trustworthy than one that's ±4% but always reads 4% high. Watch the signed
  bias line.

## Threshold

Below **50 samples** the number is *directional only* — the harness warns you.
Build the set to 50+ recently-sold homes (ideally across price bands and cities)
before putting a hard accuracy figure on the public site. See the
`valuation_calibration` project note.

## How to build a real sample set

1. Pull 50+ homes that **sold in the last ~6 months** (MLS solds, across price
   tiers and CV cities).
2. For each, run a PropertyDNA report (or use `--compute` with its raw inputs).
3. Record `actual_price` (the sold price) and `predicted_price`.
4. Run the harness. The headline replaces "97%".
