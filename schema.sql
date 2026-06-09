-- Run once against the Neon database.
CREATE TABLE IF NOT EXISTS game (
  id               text PRIMARY KEY,
  seed             text,
  locked           boolean NOT NULL DEFAULT false,
  assignments      jsonb,
  payments_enabled boolean NOT NULL DEFAULT false,  -- in-app Stitch payments on/off
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS players (
  id          serial PRIMARY KEY,
  name        text UNIQUE NOT NULL,
  position    int NOT NULL DEFAULT 0,
  confirmed   boolean NOT NULL DEFAULT false,
  paid        boolean NOT NULL DEFAULT false,
  payment_ref text,  -- Stitch externalReference tying a payment to this player
  payment_id  text   -- Stitch payment-request id
);

CREATE TABLE IF NOT EXISTS pool_results (
  match_id   text PRIMARY KEY,
  home_score int,
  away_score int
);

CREATE TABLE IF NOT EXISTS ko_results (
  id         serial PRIMARY KEY,
  round      text NOT NULL,
  team_a     text NOT NULL,
  team_b     text NOT NULL,
  score_a    int NOT NULL,
  score_b    int NOT NULL,
  pen_winner text
);

-- Seed the single game row.
INSERT INTO game (id, locked) VALUES ('current', false)
  ON CONFLICT (id) DO NOTHING;

-- Seed the 24 default players (idempotent).
INSERT INTO players (name, position) VALUES
  ('Carern',0),('Maurice',1),('Claire',2),('Adam',3),('Nick',4),('Jamie',5),
  ('Gavin',6),('Peter',7),('Merle',8),('Kim',9),('Dane',10),('Lynne',11),
  ('Brandon',12),('Mare',13),('Ben',14),('Melissa',15),('Matt',16),('Chris',17),
  ('Meegan',18),('Ethan',19),('Meggie',20),('Kyle',21),('Pat',22),('Pieter',23)
  ON CONFLICT (name) DO NOTHING;
