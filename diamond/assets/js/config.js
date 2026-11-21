/* Copie para config.js e preencha com os dados do projeto Supabase da Diamond.
   Estas duas chaves são públicas por natureza (o RLS é que protege os dados):
   o visitante só alcança serviços/profissionais ativos e as duas funções de
   agendamento. Ele não lê a tabela de agendamentos nem a de clientes. */
window.DIAMOND_CONFIG = {
  supabaseUrl: 'https://SEU-PROJETO.supabase.co',
  supabaseAnonKey: 'sua_chave_publishable_aqui',
};
