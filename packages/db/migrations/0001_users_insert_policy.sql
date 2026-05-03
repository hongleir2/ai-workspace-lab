-- Allow authenticated Supabase users to insert their own row exactly once.
-- The WITH CHECK predicate matches the SELECT/UPDATE policies' provider scoping.
CREATE POLICY "users_insert_own"
  ON users FOR INSERT TO authenticated
  WITH CHECK (
    auth_provider = 'supabase'
    AND auth_provider_user_id = auth.uid()::text
  );
