-- =============================================================================
-- 0013 — RLS avaliada uma vez por consulta, não uma vez por linha
-- =============================================================================
--
-- As policies chamavam os helpers direto: `using (is_staff())`. Como esses
-- helpers são STABLE e dependem de auth.uid(), o Postgres os coloca no filtro
-- de linha e executa um por linha varrida. Cada execução de is_staff() chama
-- app_role(), que faz `select role from profiles where id = auth.uid()`.
-- Listar 20 mil comandas disparava 20 mil consultas ao profiles.
--
-- Provado com EXPLAIN antes desta migration, como `authenticated`:
--
--   Seq Scan on public.tickets
--     Filter: ((is_staff() OR (ANY (tickets.id = (hashed SubPlan 2).col1)))
--              AND (tickets.status = 'fechada'))
--
-- `is_staff()` no Filter = por linha. Envolvendo em `(select ...)` o Postgres
-- passa a tratar como InitPlan e avalia uma única vez por consulta. É a
-- recomendação de performance do próprio Supabase e não muda em nada o
-- resultado: a função é a mesma, só o número de execuções cai.
--
-- Esta migration reescreve as policies existentes a partir do que está
-- registrado no catálogo, em vez de redeclarar as 61 à mão, para não correr o
-- risco de uma diferença entre o texto daqui e o que está no banco.
-- =============================================================================

do $$
declare
  p record;
  q text;
  w text;
  alvo text;
  n int := 0;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
      from pg_policies
     where schemaname = 'public'
       -- pula o que já estiver envolvido, para poder rodar de novo sem dobrar
       and coalesce(qual, '') !~ 'SELECT (is_staff|is_owner|current_barber_id|app_role|has_permission|auth\.uid)'
       and coalesce(with_check, '') !~ 'SELECT (is_staff|is_owner|current_barber_id|app_role|has_permission|auth\.uid)'
       and (coalesce(qual, '') ~ '(is_staff|is_owner|current_barber_id|app_role|has_permission|auth\.uid)\('
         or coalesce(with_check, '') ~ '(is_staff|is_owner|current_barber_id|app_role|has_permission|auth\.uid)\(')
  loop
    q := p.qual;
    w := p.with_check;

    -- envolve cada chamada de helper num subselect escalar
    foreach alvo in array array['is_staff()', 'is_owner()', 'current_barber_id()', 'app_role()', 'auth.uid()']
    loop
      q := replace(q, alvo, '(select ' || alvo || ')');
      w := replace(w, alvo, '(select ' || alvo || ')');
    end loop;

    -- has_permission recebe um literal; trata por expressão regular
    q := regexp_replace(q, 'has_permission\(([^()]*)\)', '(select has_permission(\1))', 'g');
    w := regexp_replace(w, 'has_permission\(([^()]*)\)', '(select has_permission(\1))', 'g');

    if q is not null and w is not null then
      execute format('alter policy %I on %I.%I using (%s) with check (%s)',
                     p.policyname, p.schemaname, p.tablename, q, w);
    elsif q is not null then
      execute format('alter policy %I on %I.%I using (%s)',
                     p.policyname, p.schemaname, p.tablename, q);
    elsif w is not null then
      execute format('alter policy %I on %I.%I with check (%s)',
                     p.policyname, p.schemaname, p.tablename, w);
    end if;

    n := n + 1;
  end loop;

  raise notice 'policies reescritas: %', n;
end $$;
