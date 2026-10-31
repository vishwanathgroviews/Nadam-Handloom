# Data files

## `india-pincodes.csv`
One row per Indian pincode: `pincode,area,city,state` (19,297 pincodes, 36 states and union
territories). Loaded into the `Pincode` table by `node scripts/load-pincodes.js --yes`, so the
website can fill in the city and state when a customer types a pincode (module W1).

- **Source:** India Post's *All India Pincode Directory* on the Open Government Data Platform
  India (data.gov.in), 157,126 post offices, as republished at
  `github.com/dropdevrahul/pincodes-india` (`pincode.csv`). Downloaded 2026-10-15.
- **Licence:** Government Open Data License – India (use and adaptation allowed with
  attribution).
- **How the file was made:** one row per pincode; `city` is the district most of its post
  offices are in, `state` likewise; `area` is its head office, else a delivering sub office,
  else a branch office, without the "H.O" / "S.O" / "B.O" ending. Names are title-cased
  ("ANDHRA PRADESH" → "Andhra Pradesh"). Three source rows had a district in the state
  column; their state was taken from pincodes with the same first three digits.
- Left out: 9xxxxx pincodes (Army post offices, which couriers don't deliver to) and
  India Post's "TEST OFFICE" (999999). A customer with such a pincode types the city and state.
- Customers can always correct the city and state on the website, so a pincode whose
  post offices span two districts is not a problem.
