-- PostGIS production scaffold (run on Supabase/Postgres after cutover from SQLite dev)
-- Not applied automatically — see docs/DATA_ROADMAP.md Wave 5

CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE "ZoningPoint"
  ADD COLUMN IF NOT EXISTS geom geometry(Point, 4326);

UPDATE "ZoningPoint"
SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
WHERE geom IS NULL AND latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS zoning_point_geom_idx ON "ZoningPoint" USING GIST (geom);

ALTER TABLE "ContaminatedSite"
  ADD COLUMN IF NOT EXISTS geom geometry(Point, 4326);

UPDATE "ContaminatedSite"
SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
WHERE geom IS NULL AND latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS contaminated_site_geom_idx ON "ContaminatedSite" USING GIST (geom);

ALTER TABLE "HeritageSite"
  ADD COLUMN IF NOT EXISTS geom geometry(Point, 4326);

UPDATE "HeritageSite"
SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
WHERE geom IS NULL AND latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS heritage_site_geom_idx ON "HeritageSite" USING GIST (geom);

-- Polygon zoning: real "what zoning applies to this lot" via ST_Contains.
-- geometryJson (GeoJSON text) is the portable source of truth; geom is the
-- indexed PostGIS column populated from it for fast containment queries.
ALTER TABLE "ZoningPolygon"
  ADD COLUMN IF NOT EXISTS geom geometry(MultiPolygon, 4326);

UPDATE "ZoningPolygon"
SET geom = ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON("geometryJson"), 4326))
WHERE geom IS NULL AND "geometryJson" IS NOT NULL;

CREATE INDEX IF NOT EXISTS zoning_polygon_geom_idx ON "ZoningPolygon" USING GIST (geom);
