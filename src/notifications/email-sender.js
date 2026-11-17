// Diagnostic administrateur sans clé, adresse locale ni inventaire des domaines du compte.
export function emailSenderDomain(from) {
  const value = String(from ?? '').trim(),
    address = /<([^<>]+)>$/.exec(value)?.[1] ?? value;
  return (
    /^[^\s<>@]+@([a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,})$/i.exec(address)?.[1].toLowerCase() ??
    null
  );
}
export async function emailSenderStatus(env, fetcher = fetch) {
  const domain = emailSenderDomain(env.EMAIL_FROM),
    testSender = domain === 'resend.dev' || domain?.endsWith('.resend.dev') === true;
  const result = {
    domain,
    test_sender: testSender,
    verified: false,
    spf: 'unknown',
    dkim: 'unknown',
    verified_domains: null,
    code: 'EMAIL_SENDER_MISSING'
  };
  if (!domain || !env.RESEND_API_KEY) return result;
  try {
    const get = (path) =>
      fetcher('https://api.resend.com' + path, {
        headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY },
        signal: AbortSignal.timeout(8000)
      });
    const response = await get('/domains?limit=100');
    if (!response.ok)
      return {
        ...result,
        code: response.status === 403 ? 'RESEND_DOMAIN_ACCESS_DENIED' : 'RESEND_DOMAIN_CHECK_FAILED'
      };
    const payload = await response.json();
    if (!Array.isArray(payload.data)) return { ...result, code: 'RESEND_DOMAIN_CHECK_FAILED' };
    result.verified_domains = payload.data.filter((d) => d.status === 'verified').length;
    const own = payload.data.find((d) => d.name?.toLowerCase() === domain);
    if (!own && payload.has_more) return { ...result, code: 'RESEND_DOMAIN_LIST_INCOMPLETE' };
    if (!own || testSender)
      return {
        ...result,
        code: testSender ? 'EMAIL_SENDER_TEST_DOMAIN' : 'EMAIL_SENDER_DOMAIN_UNVERIFIED'
      };
    const details = await get('/domains/' + encodeURIComponent(own.id));
    if (!details.ok) return { ...result, code: 'RESEND_DOMAIN_CHECK_FAILED' };
    const data = await details.json();
    const status = (record) => {
      const rows = (data.records ?? []).filter((r) => r.record === record && r.type === 'TXT');
      return rows.length && rows.every((r) => r.status === 'verified')
        ? 'verified'
        : rows.length
          ? 'pending'
          : 'unknown';
    };
    result.spf = status('SPF');
    result.dkim = status('DKIM');
    result.verified =
      data.status === 'verified' && result.spf === 'verified' && result.dkim === 'verified';
    return {
      ...result,
      code: result.verified ? 'EMAIL_SENDER_VERIFIED' : 'EMAIL_SENDER_DNS_PENDING'
    };
  } catch {
    return { ...result, code: 'RESEND_DOMAIN_CHECK_FAILED' };
  }
}
