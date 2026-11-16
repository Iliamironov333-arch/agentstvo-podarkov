-- Preserve the previous profile reputation total without adding old payments to the new monthly leaderboard.
INSERT OR IGNORE INTO reputation_transactions
  (telegram_id,actor_telegram_id,amount,source,description,leaderboard_eligible,idempotency_key,created_at)
SELECT telegram_id,NULL,amount_stars,'legacy_paid_stars','Перенос репутации из прежней системы',0,
       'legacy-payment:'||payload,COALESCE(paid_at,created_at,CURRENT_TIMESTAMP)
FROM payment_intents
WHERE status='paid' AND amount_stars>0;
INSERT OR IGNORE INTO schema_migrations(version) VALUES('0029_import_legacy_reputation');
