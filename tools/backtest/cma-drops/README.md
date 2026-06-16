# CMA drop folder

Drop FlexMLS 'statistical CMA' (closed/sold) PDF exports here, then run:

```
python3 tools/backtest/parse-cma-pdf.py tools/backtest/cma-drops/ tools/backtest/solds-from-cma.csv
```

Parser auto-detects columns, extracts SOLD price (ground truth) + address/date/
beds/baths/sqft, merges all PDFs, de-dupes by MLS#. Each CMA caps at 200 rows.
