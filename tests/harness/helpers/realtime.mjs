// Realtime postgres_changes subscription helper for Node sessions.
export async function subscribeInserts(member, table, filter) {
  const { data } = await member.sdk.auth.getSession();
  await member.sdk.realtime.setAuth(data.session.access_token);
  const events = [];
  const waiters = [];
  const channel = member.sdk.channel(`harness:${table}:${filter}:${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table, filter }, payload => {
      events.push({ at: Date.now(), row: payload.new, type: payload.eventType });
      for (const waiter of [...waiters]) if (waiter.match(payload.new)) { waiters.splice(waiters.indexOf(waiter), 1); waiter.resolve(Date.now()); }
    });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('realtime subscribe timeout')), 15000);
    // SUBSCRIBED only means the channel joined; wait until the postgres_changes listener is ready too.
    channel.on('system', {}, payload => {
      if (payload?.extension === 'postgres_changes' && payload.status === 'ok') { clearTimeout(timer); resolve(); }
      if (payload?.extension === 'postgres_changes' && payload.status === 'error') { clearTimeout(timer); reject(new Error('realtime postgres_changes error')); }
    });
    channel.subscribe(status => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { clearTimeout(timer); reject(new Error(`realtime ${status}`)); }
    });
  });
  return {
    events,
    waitFor(match, timeoutMs = 15000) {
      const hit = events.find(event => match(event.row));
      if (hit) return Promise.resolve(hit.at);
      return new Promise((resolve, reject) => {
        const waiter = { match, resolve };
        waiters.push(waiter);
        setTimeout(() => { const index = waiters.indexOf(waiter); if (index >= 0) { waiters.splice(index, 1); reject(new Error('realtime event not received')); } }, timeoutMs);
      });
    },
    close: () => member.sdk.removeChannel(channel),
  };
}
