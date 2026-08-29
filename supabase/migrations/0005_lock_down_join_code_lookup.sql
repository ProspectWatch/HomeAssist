-- household_by_join_code only needs to be callable during the (already
-- authenticated) join-household flow — revoke anon/public execute so it
-- can't be used to enumerate households before signing in.

revoke execute on function household_by_join_code(text) from public;
revoke execute on function household_by_join_code(text) from anon;
grant execute on function household_by_join_code(text) to authenticated;
