-- ============================================================================
-- DIAMOND BARBEARIA — 0012 Conteúdo do site editável pelo painel
-- Fotos dos profissionais, galeria e textos saem do código e vão para o banco.
-- ============================================================================

-- ------------------------------------------------------- armazenamento -----
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('publico','publico', true, 5242880,
        array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update
  set public = true,
      file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg','image/png','image/webp','image/avif'];

-- Qualquer visitante lê (as imagens aparecem no site); só a operação escreve.
do $$ begin
  create policy publico_leitura on storage.objects for select
  using (bucket_id = 'publico');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy publico_envio on storage.objects for insert to authenticated
  with check (bucket_id = 'publico' and public.is_staff());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy publico_troca on storage.objects for update to authenticated
  using (bucket_id = 'publico' and public.is_staff())
  with check (bucket_id = 'publico' and public.is_staff());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy publico_remocao on storage.objects for delete to authenticated
  using (bucket_id = 'publico' and public.is_staff());
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------- galeria -----
create table if not exists gallery_images (
  id          uuid primary key default gen_random_uuid(),
  url         text not null,
  caption     text,
  order_index int  not null default 0,
  active      boolean not null default true,
  created_by  uuid references profiles(id),
  created_at  timestamptz not null default now()
);
alter table gallery_images enable row level security;
alter table gallery_images force row level security;

do $$ begin
  create policy galeria_publica on gallery_images for select to anon, authenticated
  using (active);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy galeria_gestao on gallery_images for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
exception when duplicate_object then null; end $$;

grant select on gallery_images to anon;
grant select, insert, update, delete on gallery_images to authenticated;

-- ------------------------------------- textos do site (visíveis a todos) ----
-- Ficam em settings. O visitante precisa ler apenas as chaves do site.
do $$ begin
  create policy settings_publicas on settings for select to anon
  using (key in ('business','site'));
exception when duplicate_object then null; end $$;
grant select on settings to anon;

insert into settings (key, value) values
  ('site', jsonb_build_object(
     'hero', jsonb_build_object(
        'titulo1','DIAMOND', 'titulo2','BARBEARIA',
        'subtitulo','Seu estilo. Nossa assinatura.', 'desde','Desde 2015'),
     'sobre', jsonb_build_object(
        'titulo','Seja bem-vindo(a) à Diamond Barbearia',
        'paragrafo1','Mais que uma barbearia, um espaço dedicado ao cuidado com seu estilo, personalidade e identidade.',
        'paragrafo2','Desde 2015, oferecendo uma experiência de qualidade, profissionalismo e atenção aos detalhes.'),
     'manifesto', jsonb_build_object(
        'titulo','Cada corte é uma lapidação',
        'texto','Técnica, acabamento e consistência. O mesmo cuidado que transforma uma pedra bruta em diamante é o que colocamos em cada atendimento.'),
     'contato', jsonb_build_object('horarios', null, 'instagram', null)))
on conflict (key) do nothing;

-- O site lê os profissionais ativos: a foto passa a vir junto.
-- (barbers.photo_url já existe desde a 0001)
