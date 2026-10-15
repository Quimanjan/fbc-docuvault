-- FBC DocuVault database setup. Run once in the Supabase SQL editor.

create table if not exists public.registrar_emails (email text primary key);

create table if not exists public.students (
  id uuid primary key,
  name text not null,
  student_no text not null,
  course text,
  year text,
  docs jsonb not null default '{}'::jsonb,
  extras jsonb not null default '[]'::jsonb,
  sample boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.library (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid(),
  title text not null,
  category text,
  file_path text,
  file_name text,
  file_type text,
  mock text,
  person text,
  sample boolean not null default false,
  uploaded_at timestamptz not null default now()
);

create or replace function public.is_registrar() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.registrar_emails r where lower(r.email) = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;
grant execute on function public.is_registrar() to anon, authenticated;

-- Students cannot mark their own papers verified: a new or replaced file goes back to "for review",
-- and an unchanged paper keeps the status the registrar gave it.
create or replace function public.guard_student_docs() returns trigger
language plpgsql security definer set search_path = public as $$
declare k text; o jsonb; n jsonb; changed boolean;
begin
  if auth.uid() is null or public.is_registrar() then return new; end if;
  for k in select jsonb_object_keys(coalesce(new.docs, '{}'::jsonb)) loop
    n := new.docs -> k;
    o := case when tg_op = 'UPDATE' then coalesce(old.docs -> k, '{}'::jsonb) else '{}'::jsonb end;
    changed := tg_op = 'INSERT'
      or (n ->> 'path')   is distinct from (o ->> 'path')
      or (n ->> 'mock')   is distinct from (o ->> 'mock')
      or (n ->> 'serial') is distinct from (o ->> 'serial');
    if changed then
      n := n || jsonb_build_object('status', 'submitted', 'note', '');
    else
      n := n || jsonb_build_object('status', coalesce(o ->> 'status', 'submitted'), 'note', coalesce(o ->> 'note', ''));
    end if;
    new.docs := jsonb_set(new.docs, array[k], n);
  end loop;
  return new;
end $$;
drop trigger if exists guard_student_docs on public.students;
create trigger guard_student_docs before insert or update on public.students
  for each row execute function public.guard_student_docs();

alter table public.students enable row level security;
alter table public.library enable row level security;
alter table public.registrar_emails enable row level security;

drop policy if exists "students read own or registrar" on public.students;
create policy "students read own or registrar" on public.students for select to authenticated
  using (id = auth.uid() or public.is_registrar());
drop policy if exists "students create own" on public.students;
create policy "students create own" on public.students for insert to authenticated
  with check (id = auth.uid());
drop policy if exists "students update own or registrar" on public.students;
create policy "students update own or registrar" on public.students for update to authenticated
  using (id = auth.uid() or public.is_registrar()) with check (id = auth.uid() or public.is_registrar());

drop policy if exists "library own only" on public.library;
create policy "library own only" on public.library for all to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());

-- File storage: each person uploads into a folder named after their user id.
insert into storage.buckets (id, name, public, file_size_limit)
values ('papers', 'papers', false, 20971520)
on conflict (id) do update set file_size_limit = excluded.file_size_limit;

drop policy if exists "papers upload own folder" on storage.objects;
create policy "papers upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'papers' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "papers read own or registrar" on storage.objects;
create policy "papers read own or registrar" on storage.objects for select to authenticated
  using (bucket_id = 'papers' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_registrar()));
drop policy if exists "papers delete own" on storage.objects;
create policy "papers delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'papers' and (storage.foldername(name))[1] = auth.uid()::text);

-- Live updates
do $$ begin
  begin alter publication supabase_realtime add table public.students; exception when others then null; end;
  begin alter publication supabase_realtime add table public.library; exception when others then null; end;
end $$;

-- Sample students (marked SAMPLE; their papers are drawn by the app, not uploaded)
insert into public.students (id, name, student_no, course, year, sample, docs, extras) values
('00000000-0000-4000-8000-000000000001','Maria Lourdes S. Villanueva','2023-0142','BS Information Technology','4th Year',true,
 '{"form137":{"mock":"form137","person":"maria","fileName":"Form137_Villanueva.jpg","status":"verified","note":"","uploadedAt":"2026-09-03T02:10:00Z"},
   "form138":{"mock":"form138","person":"maria","fileName":"Form138_Villanueva.jpg","status":"verified","note":"","uploadedAt":"2026-09-03T02:12:00Z"},
   "psa":{"mock":"psa","person":"maria","fileName":"PSA_BirthCert.jpg","status":"verified","note":"","uploadedAt":"2026-09-04T05:00:00Z"},
   "nstp":{"serial":"C-0624-NIR-001842","mock":"nstp","person":"maria","fileName":"NSTP_Certificate.jpg","status":"verified","note":"","uploadedAt":"2026-09-04T05:05:00Z"}}',
 '[{"id":"gm01","title":"Good Moral Certificate","mock":"goodmoral","person":"maria","fileName":"GoodMoral.jpg","uploadedAt":"2026-10-02T06:00:00Z"},
   {"id":"bc01","title":"Barangay Clearance","mock":"brgy","person":"maria","fileName":"Brgy_Tagukon.jpg","uploadedAt":"2026-10-03T06:00:00Z"}]'),
('00000000-0000-4000-8000-000000000002','Mark Anthony L. Delos Reyes','2023-0217','Bachelor of Elementary Education','4th Year',true,
 '{"form137":{"mock":"form137","person":"mark","fileName":"F137_DelosReyes.jpg","status":"verified","note":"","uploadedAt":"2026-09-05T02:00:00Z"},
   "form138":{"mock":"form138","person":"mark","fileName":"F138_DelosReyes.jpg","status":"submitted","note":"","uploadedAt":"2026-10-10T02:00:00Z"},
   "nstp":{"serial":"C-0624-NIR-001907","mock":"nstp","person":"mark","fileName":"NSTP_Cert.jpg","status":"submitted","note":"","uploadedAt":"2026-10-10T02:05:00Z"}}',
 '[{"id":"gm02","title":"Good Moral Certificate","mock":"goodmoral","person":"mark","fileName":"GoodMoral.jpg","uploadedAt":"2026-10-10T02:10:00Z"}]'),
('00000000-0000-4000-8000-000000000003','Kristine Joy M. Abellar','2023-0309','BS Business Administration','4th Year',true,
 '{"form137":{"mock":"form137","person":"kristine","blur":true,"fileName":"IMG_20261005.jpg","status":"returned","note":"Scan is too blurry to read the grades. Please re-upload a clear copy.","uploadedAt":"2026-10-05T02:00:00Z"},
   "form138":{"mock":"form138","person":"kristine","fileName":"ReportCard.jpg","status":"verified","note":"","uploadedAt":"2026-10-05T02:03:00Z"},
   "psa":{"mock":"psa","person":"kristine","fileName":"PSA.jpg","status":"submitted","note":"","uploadedAt":"2026-10-12T02:00:00Z"}}',
 '[]'),
('00000000-0000-4000-8000-000000000004','Rhea Mae G. Tolentino','2024-0051','BS Information Technology','3rd Year',true,
 '{"form138":{"mock":"form138","person":"rhea","fileName":"Form138.jpg","status":"submitted","note":"","uploadedAt":"2026-10-11T02:00:00Z"}}',
 '[]')
on conflict (id) do nothing;
