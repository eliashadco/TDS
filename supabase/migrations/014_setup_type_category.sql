ALTER TABLE user_trade_structure_items
  ADD COLUMN IF NOT EXISTS setup_category TEXT;

UPDATE user_trade_structure_items
SET setup_category = CASE
  WHEN item_type <> 'setup_type' THEN NULL
  WHEN lower(family) IN ('catalyst', 'leadership', 'macro', 'fundamental', 'quality', 'valuation')
    OR lower(concat_ws(' ', label, family, detail, array_to_string(keywords, ' '))) ~ 'earnings|guidance|catalyst|news|ipo|macro|valuation|sector|leader|laggard|relative strength|relative weakness|fundamental'
    THEN 'fundamental'
  ELSE 'technical'
END
WHERE setup_category IS NULL;

ALTER TABLE user_trade_structure_items
  DROP CONSTRAINT IF EXISTS user_trade_structure_items_setup_category_check;

ALTER TABLE user_trade_structure_items
  ADD CONSTRAINT user_trade_structure_items_setup_category_check
  CHECK (
    (item_type = 'setup_type' AND setup_category IN ('fundamental', 'technical'))
    OR (item_type <> 'setup_type' AND setup_category IS NULL)
  );