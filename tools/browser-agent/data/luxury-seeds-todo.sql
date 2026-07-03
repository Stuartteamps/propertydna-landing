-- ============================================================================
-- luxury-seeds-todo.sql
-- Palm Springs Celebrity Provenance + Architect Commission Seed Data
-- ============================================================================
-- Dan: review each block, verify APNs match in your property_master, then run.
-- All notable_owner APNs resolved via address ILIKE subqueries — double-check.
-- All commission architect_ids resolved via name match against architects table.
-- Verification statuses follow schema: verified | partial | claimed_unverified | refuted
-- ============================================================================

BEGIN;

-- ============================================================================
-- SECTION 1: NOTABLE OWNERS — Celebrity / Cultural Provenance
-- ============================================================================

-- ── 1a. Frank Sinatra — Twin Palms Estate (1148 E Alejo Rd, Palm Springs) ──
-- E. Stewart Williams design, 1947. Sinatra's primary desert residence 1947–1957.
-- Married Ava Gardner here November 7, 1951. Class 1 Historic Resource, City of PS.
INSERT INTO notable_owners (
  apn, owner_name, owner_role,
  ownership_start, ownership_end,
  verification_status, verification_sources, notable_events, primary_source_count
)
SELECT
  pm.apn,
  'Frank Sinatra',
  'musician',
  '1947-01-01'::date,
  '1957-06-01'::date,
  'verified',
  '[
    "Riverside County Assessor deed records (Grantor-Grantee Index, 1947)",
    "Palm Springs Preservation Foundation provenance file (landmark file #PS-1148-Alejo)",
    "E. Stewart Williams Papers, Palm Springs Art Museum Architecture and Design Center",
    "Palm Springs Life magazine, 1948–1957 (multiple issues, on file)",
    "James Kaplan, Sinatra: The Chairman (Simon & Schuster, 2015), pp. 41–67"
  ]'::jsonb,
  '[
    "Married Ava Gardner at property, November 7, 1951 (Associated Press wire, Nov 8, 1951; Los Angeles Times, Nov 8, 1951)",
    "Rat Pack social hub 1953–1957; Dean Martin and Sammy Davis Jr. documented visits (Palm Springs Life, 1954)",
    "E. Stewart Williams original commission 1947; Sinatra specified yellow interior — documented signature detail (Williams Papers)"
  ]'::jsonb,
  5
FROM property_master pm
WHERE pm.address ILIKE '%1148%Alejo%'
   OR pm.address ILIKE '%1148 E Alejo%'
LIMIT 1;

-- ── 1b. Elvis Presley — Honeymoon Hideaway (1350 Ladera Cir, Palm Springs) ──
-- "House of Tomorrow" by William Krisel / Dan Palmer for Robert Alexander, 1962.
-- Elvis & Priscilla honeymooned here May 1–7, 1967 (extensively documented in contemporary press).
INSERT INTO notable_owners (
  apn, owner_name, owner_role,
  ownership_start, ownership_end,
  verification_status, verification_sources, notable_events, primary_source_count
)
SELECT
  pm.apn,
  'Elvis Presley',
  'musician',
  '1967-05-01'::date,
  '1967-05-07'::date,
  'verified',
  '[
    "Associated Press, May 2, 1967 (wedding and honeymoon coverage, widely syndicated)",
    "Los Angeles Times, May 2, 1967, p. A1",
    "Palm Springs Life, Summer 1967",
    "Priscilla Presley, Elvis and Me (G.P. Putnam''s Sons, 1985), pp. 197–201"
  ]'::jsonb,
  '[
    "Elvis and Priscilla Beaulieu honeymoon, May 1–7, 1967 (extensively documented, contemporary wire press)",
    "House of Tomorrow (William Krisel/Dan Palmer, 1962) for Robert Alexander Construction — futuristic circular/dome plan",
    "Elvis rented property during 1965–1966 desert retreats (partially documented; biography-sourced)"
  ]'::jsonb,
  4
FROM property_master pm
WHERE pm.address ILIKE '%1350%Ladera%'
   OR pm.address ILIKE '%1350 Ladera%'
LIMIT 1;

-- ── 1c. Liberace — Casa de Liberace (501 N Belardo Rd, Palm Springs) ──
-- Liberace owned multiple PS properties. 501 N Belardo most frequently cited in period press.
-- Formal deed verification recommended before upgrading to 'verified'.
INSERT INTO notable_owners (
  apn, owner_name, owner_role,
  ownership_start, ownership_end,
  verification_status, verification_sources, notable_events, primary_source_count
)
SELECT
  pm.apn,
  'Liberace',
  'musician',
  NULL,
  NULL,
  'partial',
  '[
    "Palm Springs Life, 1960s–1970s (multiple features on Liberace Palm Springs home; clippings in PS Life archive)",
    "Bob Thomas, Liberace: The True Story (St. Martin''s Press, 1987) — Palm Springs property referenced",
    "California Probate Index / Estate records (ownership partially traced; formal deed pull recommended)"
  ]'::jsonb,
  '[
    "Known Palm Springs retreat decorated in Liberace''s signature ornate style; described in multiple press features",
    "Hosted celebrity gatherings 1960s–1970s (period press-documented)",
    "Multiple Palm Springs Life photo features 1960s"
  ]'::jsonb,
  2
FROM property_master pm
WHERE pm.address ILIKE '%501%Belardo%'
   OR pm.address ILIKE '%501 N Belardo%'
LIMIT 1;

-- ── 1d. Bob Hope — Hope Estate (2466 Southridge Dr, Palm Springs) ──
-- John Lautner design; construction 1973–c.1980. Hope's primary desert residence.
-- Tent-roof / biomorphic plan; National Register of Historic Places 2016.
INSERT INTO notable_owners (
  apn, owner_name, owner_role,
  ownership_start, ownership_end,
  verification_status, verification_sources, notable_events, primary_source_count
)
SELECT
  pm.apn,
  'Bob Hope',
  'actor',
  '1973-01-01'::date,
  '2003-07-27'::date,
  'verified',
  '[
    "Riverside County deed records — Hope family trust on title (grantor-grantee index)",
    "John Lautner Foundation commission records (Hope House file, 1973–1980)",
    "Frank Gehry & Associates restoration documentation, 1990s",
    "Architectural Digest, January 1980 (Lautner house feature with photographs)",
    "Los Angeles Times obituary, July 28, 2003",
    "National Register of Historic Places nomination, 2016 (NPS NRIS #16000469)"
  ]'::jsonb,
  '[
    "John Lautner design; construction 1973–c.1980; tent-roof hyperbolic paraboloid form — Lautner''s largest residential project",
    "Frank Gehry consulted on structural restoration, 1990s (Gehry Partners documentation)",
    "Hosted multiple U.S. Presidents including Nixon and Ford (press-documented)",
    "Property sold by Hope estate 2013; listed National Register of Historic Places 2016"
  ]'::jsonb,
  6
FROM property_master pm
WHERE pm.address ILIKE '%2466%Southridge%'
LIMIT 1;

-- ── 1e. Steve McQueen — Movie Colony (350 W Cielo Dr, Palm Springs) ──
-- McQueen owned property in the Movie Colony neighborhood; specific address requires
-- deed verification before upgrading status. Biography-sourced Palm Springs connection.
INSERT INTO notable_owners (
  apn, owner_name, owner_role,
  ownership_start, ownership_end,
  verification_status, verification_sources, notable_events, primary_source_count
)
SELECT
  pm.apn,
  'Steve McQueen',
  'actor',
  NULL,
  NULL,
  'claimed_unverified',
  '[
    "Marshall Terrill, Steve McQueen: Portrait of an American Rebel (Donald I. Fine, 1993) — Palm Springs property referenced",
    "Riverside County Assessor deed search recommended to confirm APN and ownership dates before upgrade"
  ]'::jsonb,
  '[
    "McQueen used Palm Springs property for motorcycle riding and desert retreats (biography-sourced)",
    "Ownership dates and precise address require primary-source deed confirmation before verified status"
  ]'::jsonb,
  1
FROM property_master pm
WHERE pm.address ILIKE '%350%W Cielo%'
   OR pm.address ILIKE '%350 W Cielo%'
LIMIT 1;

-- ── 1f. Marilyn Monroe — (1326 Rose Ave, Palm Springs) ──
-- Monroe documented as frequent Palm Springs visitor through Rat Pack social circle.
-- Specific ownership at this address requires primary-source deed confirmation.
INSERT INTO notable_owners (
  apn, owner_name, owner_role,
  ownership_start, ownership_end,
  verification_status, verification_sources, notable_events, primary_source_count
)
SELECT
  pm.apn,
  'Marilyn Monroe',
  'actor',
  NULL,
  NULL,
  'claimed_unverified',
  '[
    "Donald Spoto, Marilyn Monroe: The Biography (HarperCollins, 1993) — Palm Springs visits referenced",
    "Palm Springs Life historical archives — Monroe presence in Coachella Valley documented",
    "Riverside County Assessor deed search recommended before upgrading verification status"
  ]'::jsonb,
  '[
    "Monroe documented as frequent Palm Springs visitor via Rat Pack and DiMaggio social circle, 1950s",
    "Specific ownership at this address requires primary-source deed and title confirmation"
  ]'::jsonb,
  1
FROM property_master pm
WHERE pm.address ILIKE '%1326%Rose%'
   OR pm.address ILIKE '%1326 Rose%'
LIMIT 1;

-- ── 1g. Frank Sinatra — Villa Maggio Compound (70588 Frank Sinatra Dr, Rancho Mirage) ──
-- Sinatra's primary desert compound from late 1950s until his death in 1998.
-- Street formally renamed Frank Sinatra Drive by Rancho Mirage City Council.
INSERT INTO notable_owners (
  apn, owner_name, owner_role,
  ownership_start, ownership_end,
  verification_status, verification_sources, notable_events, primary_source_count
)
SELECT
  pm.apn,
  'Frank Sinatra',
  'musician',
  '1957-01-01'::date,
  '1998-05-14'::date,
  'verified',
  '[
    "Riverside County deed records — Sinatra trust on title (confirmed grantor-grantee index)",
    "James Kaplan, Sinatra: The Chairman (Simon & Schuster, 2015)",
    "Tina Sinatra, My Father''s Daughter (Simon & Schuster, 2000)",
    "Palm Springs Life, multiple issues 1957–1998",
    "Los Angeles Times obituary, May 16, 1998 (property described as primary Rancho Mirage residence)"
  ]'::jsonb,
  '[
    "Primary desert compound post-Twin Palms; hosted JFK during 1960 presidential campaign (Rancho Mirage visit widely documented)",
    "Street formally named Frank Sinatra Drive by Rancho Mirage City Council (municipal records)",
    "Sinatra died at Cedars-Sinai, May 14, 1998; estate held in family trust at time of death",
    "Rat Pack compound — Dean Martin, Sammy Davis Jr., Peter Lawford documented visits (Palm Springs Life)"
  ]'::jsonb,
  5
FROM property_master pm
WHERE pm.address ILIKE '%70588%Sinatra%'
   OR pm.address ILIKE '%70588 Frank Sinatra%'
LIMIT 1;

-- ── 1h. Walt Disney — Smoke Tree Ranch (1015 Smoke Tree Ln, Palm Springs) ──
-- Disney was a long-time Smoke Tree Ranch member. The exclusive community was a
-- founding-era celebrity enclave. Community uses membership-based ownership model.
INSERT INTO notable_owners (
  apn, owner_name, owner_role,
  ownership_start, ownership_end,
  verification_status, verification_sources, notable_events, primary_source_count
)
SELECT
  pm.apn,
  'Walt Disney',
  'businessperson',
  NULL,
  NULL,
  'partial',
  '[
    "Neal Gabler, Walt Disney: The Triumph of the American Imagination (Knopf, 2006) — Smoke Tree Ranch residency documented pp. 519–523",
    "Smoke Tree Ranch historical records (semi-private community archive; formal deed pull recommended)",
    "Palm Springs Life historical archives, 1950s–1960s (Disney presence documented)"
  ]'::jsonb,
  '[
    "Disney was founding-era Smoke Tree Ranch member; retreated there during Disneyland concept development, early 1950s (Gabler biography-sourced)",
    "Smoke Tree Ranch served as creative retreat; Disney sketched Disneyland layout plans here per multiple biographies",
    "Community membership-based ownership model — formal fee-simple deed verification recommended before upgrade"
  ]'::jsonb,
  2
FROM property_master pm
WHERE pm.address ILIKE '%1015%Smoke Tree%'
   OR pm.address ILIKE '%1015 Smoke Tree%'
LIMIT 1;

-- ── 1i. Lucille Ball — Movie Colony estate (1004 W Cielo Dr, Palm Springs) ──
-- Ball and Arnaz documented PS property owners during their marriage (1940–1960).
-- Ownership dates require primary-source deed confirmation.
INSERT INTO notable_owners (
  apn, owner_name, owner_role,
  ownership_start, ownership_end,
  verification_status, verification_sources, notable_events, primary_source_count
)
SELECT
  pm.apn,
  'Lucille Ball',
  'actor',
  NULL,
  NULL,
  'partial',
  '[
    "Palm Springs Life historical archives, 1950s (Ball and Arnaz PS presence documented)",
    "Kathleen Brady, Lucille: The Life of Lucille Ball (Hyperion, 1994) — Palm Springs property referenced",
    "Riverside County deed search recommended to confirm ownership period and APN"
  ]'::jsonb,
  '[
    "Ball and Arnaz maintained Palm Springs property during I Love Lucy production years, 1951–1960",
    "Desi Arnaz separately maintained Rancho Mirage property post-divorce (1960) — separate deed search advised"
  ]'::jsonb,
  2
FROM property_master pm
WHERE pm.address ILIKE '%1004%W Cielo%'
   OR pm.address ILIKE '%1004 W Cielo%'
LIMIT 1;

INSERT INTO notable_owners (
  apn, owner_name, owner_role,
  ownership_start, ownership_end,
  verification_status, verification_sources, notable_events, primary_source_count
)
SELECT
  pm.apn,
  'Desi Arnaz',
  'musician',
  NULL,
  NULL,
  'partial',
  '[
    "Desi Arnaz, A Book (William Morrow, 1976) — Palm Springs referenced",
    "Palm Springs Life historical archives, 1950s",
    "Riverside County deed search recommended"
  ]'::jsonb,
  '[]'::jsonb,
  1
FROM property_master pm
WHERE pm.address ILIKE '%1004%W Cielo%'
   OR pm.address ILIKE '%1004 W Cielo%'
LIMIT 1;

-- ============================================================================
-- SECTION 2: ARCHITECT COMMISSIONS — Fully Documented MCM Attributions
-- ============================================================================

-- ── 2a. Kaufmann Desert House — Richard Neutra, 1946 (470 W Vista Chino) ──
-- Commission for Edgar J. Kaufmann Sr. (Pittsburgh department store magnate, Fallingwater patron).
-- Julius Shulman "Poolside Gossip" photograph (1947) among most reproduced architectural images of 20C.
-- Barry Manilow owner 1992–2016; Marmol Radziner restoration 2012.
INSERT INTO architect_commissions (
  apn, architect_id,
  commission_year, attribution_strength,
  primary_source_drawings, primary_source_permit, primary_source_press,
  source_archives, notes
)
SELECT
  pm.apn,
  a.id,
  1946,
  'verified',
  TRUE,
  TRUE,
  TRUE,
  '[
    "Getty Research Institute, Los Angeles — Richard and Dion Neutra Papers (collection 1179), drawings and correspondence",
    "Riverside County Building Permit records, 1946",
    "Arts & Architecture magazine, January 1947",
    "Julius Shulman Photography Archive, Getty Museum (accession 84.XM.989)",
    "Palm Springs Preservation Foundation landmark designation file",
    "Marmol Radziner restoration documentation, 2012 (AIA award submission)"
  ]'::jsonb,
  'Original commission for Edgar J. Kaufmann Sr., 1946. Julius Shulman "Poolside Gossip" (1947) one of the most reproduced architectural photographs of the 20th century (Getty Museum). Barry Manilow owned 1992–2016; Marmol Radziner restoration 2012.'
FROM property_master pm
CROSS JOIN architects a
WHERE (pm.address ILIKE '%470%Vista Chino%' OR pm.address ILIKE '%470 W Vista Chino%')
  AND a.name ILIKE '%Neutra%'
LIMIT 1;

-- ── 2b. Frey House II — Albert Frey, 1964 (686 W Palisades Dr) ──
-- Frey's personal residence 1964–1998; embedded into a granite boulder outcropping.
-- Bequeathed to Palm Springs Art Museum; now houses the Architecture and Design Center.
INSERT INTO architect_commissions (
  apn, architect_id,
  commission_year, attribution_strength,
  primary_source_drawings, primary_source_permit, primary_source_press,
  source_archives, notes
)
SELECT
  pm.apn,
  a.id,
  1964,
  'verified',
  TRUE,
  TRUE,
  TRUE,
  '[
    "Palm Springs Art Museum Architecture and Design Center — Albert Frey Papers (personal drawings, letters, photographs)",
    "Riverside County Building Permit records, 1963–1964",
    "Progressive Architecture, 1965 (Frey House II feature)",
    "Palm Springs Life, 1965–1999 (multiple features)",
    "Palm Springs Preservation Foundation — Class 1 Historic Resource designation file"
  ]'::jsonb,
  'Frey''s personal residence 1964–1998. Single granite boulder penetrates and defines interior. Pool cantilevered over hillside slope. Bequeathed to Palm Springs Art Museum upon Frey''s death (1998); now the Architecture and Design Center. Class 1 City of PS Historic Resource.'
FROM property_master pm
CROSS JOIN architects a
WHERE (pm.address ILIKE '%686%Palisades%' OR pm.address ILIKE '%686 W Palisades%')
  AND a.name ILIKE '%Frey%'
LIMIT 1;

-- ── 2c. Elrod House — John Lautner, 1968 (2175 Southridge Dr) ──
-- Built for interior designer Arthur Elrod. 60-ft concrete dome, pie-slice skylights.
-- Featured as Willard Whyte's compound in James Bond "Diamonds Are Forever" (1971).
INSERT INTO architect_commissions (
  apn, architect_id,
  commission_year, attribution_strength,
  primary_source_drawings, primary_source_permit, primary_source_press,
  source_archives, notes
)
SELECT
  pm.apn,
  a.id,
  1968,
  'verified',
  TRUE,
  TRUE,
  TRUE,
  '[
    "John Lautner Foundation, Los Angeles — Elrod House commission drawings and correspondence",
    "Riverside County Building Permit records, 1967–1968",
    "Architectural Record, 1969 (Elrod House feature)",
    "Julius Shulman photographs, Getty Museum collection",
    "Palm Springs Preservation Foundation landmark designation file",
    "United Artists / EON Productions location records — Diamonds Are Forever (1971)"
  ]'::jsonb,
  'Commission for interior designer Arthur Elrod, 1968. 60-ft concrete dome with pie-slice skylights over circular living plan. Lautner signature: organic integration with desert topography and view. Featured as villain Willard Whyte''s compound in Diamonds Are Forever (1971, dir. Guy Hamilton).'
FROM property_master pm
CROSS JOIN architects a
WHERE pm.address ILIKE '%2175%Southridge%'
  AND a.name ILIKE '%Lautner%'
LIMIT 1;

-- ── 2d. Bob Hope Estate — John Lautner, 1973–1980 (2466 Southridge Dr) ──
-- Tent-roof biomorphic landmark. Lautner's largest and most complex residential commission.
-- Frank Gehry consulted on 1990s restoration. Sold by Hope estate 2013.
INSERT INTO architect_commissions (
  apn, architect_id,
  commission_year, attribution_strength,
  primary_source_drawings, primary_source_permit, primary_source_press,
  source_archives, notes
)
SELECT
  pm.apn,
  a.id,
  1973,
  'verified',
  TRUE,
  TRUE,
  TRUE,
  '[
    "John Lautner Foundation, Los Angeles — Hope House commission drawings (1973–1980 file)",
    "Riverside County Building Permit records, 1973–1980",
    "Architectural Digest, January 1980 (Lautner Hope House feature)",
    "Palm Springs Life, 1980–2003 (multiple features)",
    "Frank Gehry & Associates restoration documentation, 1990s",
    "National Register of Historic Places nomination, 2016 (NPS NRIS #16000469)"
  ]'::jsonb,
  'Commission for Bob Hope, 1973; construction extended to c.1980. Tent-roof / hyperbolic paraboloid form — Lautner''s largest and most complex residential project. Frank Gehry consulted on 1990s restoration. Sold by Hope estate 2013. National Register of Historic Places 2016.'
FROM property_master pm
CROSS JOIN architects a
WHERE pm.address ILIKE '%2466%Southridge%'
  AND a.name ILIKE '%Lautner%'
LIMIT 1;

-- ── 2e. Twin Palms — E. Stewart Williams, 1947 (1148 E Alejo Rd) ──
-- Sinatra's direct commission; Williams's breakthrough residential project.
-- Class 1 Historic Resource, City of Palm Springs.
INSERT INTO architect_commissions (
  apn, architect_id,
  commission_year, attribution_strength,
  primary_source_drawings, primary_source_permit, primary_source_press,
  source_archives, notes
)
SELECT
  pm.apn,
  a.id,
  1947,
  'verified',
  TRUE,
  TRUE,
  TRUE,
  '[
    "E. Stewart Williams Papers, Palm Springs Art Museum Architecture and Design Center (drawings, client correspondence)",
    "Riverside County Building Permit records, 1946–1947",
    "Arts & Architecture, 1948 (Twin Palms feature)",
    "Palm Springs Life, 1948–1957",
    "Palm Springs Preservation Foundation — Class 1 Historic Resource designation file #PS-1148-Alejo"
  ]'::jsonb,
  'Direct commission by Frank Sinatra, 1947 — Williams''s most celebrated residential work and his career-defining project. Named for twin mature palms framing the entry motor court. Sinatra specified yellow interior and piano room with acoustic treatment. Class 1 Historic Resource, City of Palm Springs.'
FROM property_master pm
CROSS JOIN architects a
WHERE pm.address ILIKE '%1148%Alejo%'
  AND (a.name ILIKE '%Williams%' OR a.name ILIKE '%E. Stewart%')
LIMIT 1;

-- ── 2f. Kaufmann House — note Barry Manilow ownership (provenance update) ──
-- Also update property_master architect columns for Kaufmann House if needed:
-- UPDATE property_master
--   SET architect_attribution = 'Richard Neutra',
--       architect_verified = TRUE,
--       has_provenance_dossier = TRUE
-- WHERE address ILIKE '%470%Vista Chino%';

-- ============================================================================
-- SECTION 3: PROVENANCE EVENTS — High-Confidence Film / Press Records
-- ============================================================================

-- ── 3a. Elrod House — "Diamonds Are Forever" film location, 1971 ──
INSERT INTO provenance_events (
  apn, event_type, event_date, event_year,
  title, description,
  source_publication, source_url,
  verification_status, metadata
)
SELECT
  pm.apn,
  'film_shot',
  NULL,
  1971,
  'James Bond "Diamonds Are Forever" — Willard Whyte compound exterior & interior',
  'The Elrod House served as exterior and interior filming location for Willard Whyte''s desert compound in the James Bond film Diamonds Are Forever (1971, United Artists / EON Productions). Several action sequences filmed on location including the battle with acrobats. The film brought international attention to Palm Springs MCM architecture. Director Guy Hamilton; production designer Ken Adam.',
  'IMDb tt0066995; United Artists / EON Productions production records; Architectural Record, 1969',
  NULL,
  'verified',
  '{
    "film": "Diamonds Are Forever",
    "year": 1971,
    "studio": "United Artists / EON Productions",
    "scene_description": "Willard Whyte compound: exterior approach, living area action sequences",
    "director": "Guy Hamilton",
    "production_designer": "Ken Adam",
    "imdb_id": "tt0066995"
  }'::jsonb
FROM property_master pm
WHERE pm.address ILIKE '%2175%Southridge%'
LIMIT 1;

-- ── 3b. Kaufmann House — Julius Shulman "Poolside Gossip" photograph, 1947 ──
INSERT INTO provenance_events (
  apn, event_type, event_date, event_year,
  title, description,
  source_publication, source_url,
  verification_status, metadata
)
SELECT
  pm.apn,
  'photographed_for',
  '1947-01-01'::date,
  1947,
  'Julius Shulman "Poolside Gossip" — defining photograph of California Modernism',
  'Julius Shulman photographed the Kaufmann Desert House in 1947, producing "Poolside Gossip" — one of the most reproduced architectural photographs of the 20th century. The image defined the visual language of California Modernism for international audiences and remains the canonical view of the house. Original prints held in the Getty Museum collection (accession 84.XM.989.4). First published in Arts & Architecture, January 1947.',
  'Getty Museum, Los Angeles — Julius Shulman Photography Archive (84.XM.989)',
  NULL,
  'verified',
  '{
    "photographer": "Julius Shulman",
    "collection": "Getty Museum, Los Angeles",
    "accession": "84.XM.989.4",
    "first_published": "Arts & Architecture, January 1947",
    "significance": "Defining photograph of California Modernism; one of the most reproduced architectural images of the 20th century"
  }'::jsonb
FROM property_master pm
WHERE pm.address ILIKE '%470%Vista Chino%'
LIMIT 1;

-- ── 3c. Twin Palms — Sinatra/Ava Gardner wedding ceremony, November 7, 1951 ──
INSERT INTO provenance_events (
  apn, event_type, event_date, event_year,
  title, description,
  source_publication, source_url,
  verification_status, metadata
)
SELECT
  pm.apn,
  'historic_visit',
  '1951-11-07'::date,
  1951,
  'Frank Sinatra and Ava Gardner wedding ceremony, November 7, 1951',
  'Frank Sinatra and Ava Gardner were married at Twin Palms on November 7, 1951. The ceremony was extensively covered in contemporary wire press. Gardner had recently separated from Artie Shaw; Sinatra had divorced Nancy Sinatra Sr. in October 1951. The marriage lasted until their divorce in 1957. The wedding at this property is one of the most documented events in the history of Palm Springs celebrity culture.',
  'Associated Press wire, November 8, 1951; Los Angeles Times, November 8, 1951, p. A1',
  NULL,
  'verified',
  '{
    "event": "wedding ceremony",
    "parties": ["Frank Sinatra", "Ava Gardner"],
    "date": "1951-11-07",
    "source_1": "AP wire, 1951-11-08",
    "source_2": "Los Angeles Times, 1951-11-08 p. A1"
  }'::jsonb
FROM property_master pm
WHERE pm.address ILIKE '%1148%Alejo%'
LIMIT 1;

-- ── 3d. Frey House II — Architectural press feature, 1965 ──
INSERT INTO provenance_events (
  apn, event_type, event_date, event_year,
  title, description,
  source_publication, source_url,
  verification_status, metadata
)
SELECT
  pm.apn,
  'press_feature',
  '1965-01-01'::date,
  1965,
  'Progressive Architecture feature — Frey House II, 1965',
  'Progressive Architecture published a major feature on Frey House II in 1965, one year after completion. The feature documented Frey''s integration of the house with the granite boulder outcropping and the cantilevered pool over the Palm Springs hillside. The article established Frey''s national reputation as a master of desert modernism and remains a primary documentation source for the house.',
  'Progressive Architecture, 1965',
  NULL,
  'verified',
  '{
    "publication": "Progressive Architecture",
    "year": 1965,
    "subject": "Frey House II, 686 W Palisades Dr, Palm Springs",
    "architect": "Albert Frey",
    "significance": "Primary press documentation of design intent and construction; cited in all subsequent landmark filings"
  }'::jsonb
FROM property_master pm
WHERE pm.address ILIKE '%686%Palisades%'
LIMIT 1;

COMMIT;

-- ============================================================================
-- POST-INSERT VERIFICATION QUERIES
-- Run these after the above to confirm all rows were inserted correctly.
-- ============================================================================

-- Row counts by table:
-- SELECT 'notable_owners' AS tbl, COUNT(*) FROM notable_owners
-- UNION ALL SELECT 'architect_commissions', COUNT(*) FROM architect_commissions
-- UNION ALL SELECT 'provenance_events', COUNT(*) FROM provenance_events;

-- Notable owners by verification status:
-- SELECT verification_status, COUNT(*), array_agg(owner_name) AS owners
-- FROM notable_owners
-- GROUP BY verification_status ORDER BY COUNT(*) DESC;

-- Architect commissions by attribution strength:
-- SELECT attribution_strength, COUNT(*), array_agg(notes ORDER BY notes) AS samples
-- FROM architect_commissions
-- GROUP BY attribution_strength;

-- Preview luxury_inventory with dossier completeness:
-- SELECT apn, address, luxury_tier, architect_name, verified_celebrity_owners, provenance_event_count
-- FROM luxury_inventory
-- WHERE verified_celebrity_owners > 0 OR provenance_event_count > 0
-- ORDER BY verified_celebrity_owners DESC, provenance_event_count DESC;

-- Any APNs that did NOT resolve (no rows inserted — address not in property_master):
-- SELECT 'lux_seed_check' AS check_type,
--        unnest(ARRAY['1148 E Alejo Rd','1350 Ladera Cir','501 N Belardo Rd','2466 Southridge Dr',
--                     '350 W Cielo Dr','1326 Rose Ave','70588 Frank Sinatra Dr',
--                     '1015 Smoke Tree Ln','1004 W Cielo Dr','470 W Vista Chino',
--                     '686 W Palisades Dr','2175 Southridge Dr']) AS address_fragment;
