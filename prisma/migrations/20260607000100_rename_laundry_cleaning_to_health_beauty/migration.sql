DO $$
DECLARE
  legacy_id text;
  replacement_id text;
BEGIN
  SELECT id INTO legacy_id
  FROM "Category"
  WHERE lower(name) = lower('Laundry & Cleaning') OR slug = 'laundry-cleaning'
  LIMIT 1;

  SELECT id INTO replacement_id
  FROM "Category"
  WHERE lower(name) = lower('Health & Beauty') OR slug = 'health-beauty'
  LIMIT 1;

  IF legacy_id IS NOT NULL AND replacement_id IS NOT NULL AND legacy_id <> replacement_id THEN
    UPDATE "Product"
    SET "categoryId" = replacement_id
    WHERE "categoryId" = legacy_id;

    DELETE FROM "Category"
    WHERE id = legacy_id;
  ELSIF legacy_id IS NOT NULL THEN
    UPDATE "Category"
    SET name = 'Health & Beauty',
        slug = 'health-beauty',
        "updatedAt" = NOW()
    WHERE id = legacy_id;
  ELSIF replacement_id IS NULL THEN
    INSERT INTO "Category" (id, name, slug, description, "imageUrl", "createdAt", "updatedAt")
    VALUES (
      'health-beauty-default',
      'Health & Beauty',
      'health-beauty',
      'Products grouped under Health & Beauty.',
      '/images/placeholder.svg',
      NOW(),
      NOW()
    );
  END IF;
END $$;
