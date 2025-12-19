-- Conversation helper functions (leave/delete behavior) with RLS-safe execution.
-- These functions are SECURITY DEFINER so they can update/delete rows even when
-- the client role is restricted by RLS.

create or replace function public.leave_conversation(conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_participants text[];
  next_participants text[];
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  -- Lock the conversation row to avoid concurrent "leave" races.
  select c.participants
    into current_participants
  from public.conversations c
  where c.id = conversation_id
  for update;

  if not found then
    raise exception 'Conversation not found';
  end if;

  if not (auth.uid()::text = any(current_participants)) then
    raise exception 'Not a participant in this conversation';
  end if;

  next_participants := array_remove(current_participants, auth.uid()::text);

  if coalesce(array_length(next_participants, 1), 0) = 0 then
    delete from public.conversations c
    where c.id = conversation_id;
  else
    update public.conversations c
    set participants = next_participants,
        updated_at = now()
    where c.id = conversation_id;
  end if;
end;
$$;

grant execute on function public.leave_conversation(uuid) to authenticated;

