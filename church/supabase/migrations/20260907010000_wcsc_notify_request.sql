-- 새 지원 신청이 들어오면 담당자에게 메일이 가도록 합니다.
-- (Supabase 에 적용 완료 — 이 파일은 기록용입니다.)

create extension if not exists pg_net with schema extensions;

do $$
declare v_id uuid;
begin
  select id into v_id from vault.secrets where name = 'notify_hook_secret';
  if v_id is null then
    perform vault.create_secret(encode(extensions.gen_random_bytes(24), 'hex'), 'notify_hook_secret');
  end if;
end $$;

create or replace function public.notify_new_request()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  v_secret text;
begin
  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'notify_hook_secret';

  if v_secret is null then
    return new;
  end if;

  perform net.http_post(
    url := 'https://tbxosynzszcgtieonsui.supabase.co/functions/v1/notify-request',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-hook-secret', v_secret
    ),
    body := jsonb_build_object(
      'code', new.code,
      'church', coalesce(new.church_name, ''),
      'name', coalesce(new.contact_name, ''),
      'phone', coalesce(new.phone, ''),
      'email', coalesce(new.email, ''),
      'services', coalesce(new.services::text, ''),
      'message', coalesce(new.message, ''),
      'createdAt', new.created_at
    )
  );
  return new;
end $$;

drop trigger if exists on_request_created on public.requests;
create trigger on_request_created
  after insert on public.requests
  for each row execute function public.notify_new_request();
