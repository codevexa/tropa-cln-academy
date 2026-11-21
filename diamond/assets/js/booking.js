/* =====================================================================
   DIAMOND BARBEARIA — agendamento do site público
   Conversa com o Supabase por REST. Sem biblioteca: são duas funções
   (public_available_slots e public_book) e duas leituras.
   Sem configuração, o fluxo continua como demonstração visual e avisa.
   ===================================================================== */
(function () {
  'use strict';

  var CFG = window.DIAMOND_CONFIG || {};
  var URL_BASE = (CFG.supabaseUrl || '').replace(/\/+$/, '');
  var KEY = CFG.supabaseAnonKey || '';
  var ONLINE = Boolean(URL_BASE && KEY && URL_BASE.indexOf('SEU-PROJETO') === -1);

  function api(path, options) {
    options = options || {};
    return fetch(URL_BASE + '/rest/v1' + path, {
      method: options.method || 'GET',
      headers: {
        apikey: KEY,
        Authorization: 'Bearer ' + KEY,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    }).then(function (r) {
      return r.json().then(function (data) {
        if (!r.ok) {
          var msg = (data && (data.message || data.hint || data.error)) || 'Falha na comunicação';
          throw new Error(msg);
        }
        return data;
      });
    });
  }

  var Booking = {
    online: ONLINE,
    /** Serviços ativos, na ordem da tabela de preços. */
    services: function () {
      return api('/services?select=id,name,duration_min,price,category&active=eq.true&order=order_index');
    },
    /** Profissionais ativos, com foto e apresentação. */
    barbers: function () {
      return api('/barbers?select=id,display_name,specialty,bio,photo_url&active=eq.true&order=order_index');
    },
    /** Textos do site e dados do estabelecimento, editados no painel. */
    content: function () {
      return api('/settings?select=key,value&key=in.(site,business)').then(function (rows) {
        var out = {};
        (rows || []).forEach(function (r) { out[r.key] = r.value; });
        return out;
      });
    },
    /** Fotos da galeria publicadas pelo painel. */
    gallery: function () {
      return api('/gallery_images?select=url,caption&active=eq.true&order=order_index');
    },
    /** Horários realmente livres, calculados no servidor. */
    slots: function (barberId, isoDate, serviceId) {
      return api('/rpc/public_available_slots', {
        method: 'POST',
        body: { p_barber: barberId, p_date: isoDate, p_service: serviceId },
      }).then(function (rows) {
        return (rows || []).map(function (r) {
          return typeof r === 'string' ? r : r.slot;
        });
      });
    },
    /** Cria o agendamento. O servidor recusa horário ocupado ou passado. */
    book: function (data) {
      return api('/rpc/public_book', {
        method: 'POST',
        body: {
          p_barber: data.barberId, p_service: data.serviceId,
          p_starts_at: data.startsAt, p_name: data.name,
          p_phone: data.phone, p_notes: data.notes || null,
        },
      });
    },
  };

  window.DiamondBooking = Booking;
})();
