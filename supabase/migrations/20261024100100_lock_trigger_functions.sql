-- create_profile only runs as the sign-up trigger; nobody calls it through the API.
-- The other security definer functions are meant to be called by signed-in
-- players and check auth.uid() and class membership themselves.
revoke all on function public.create_profile() from public, anon, authenticated;
