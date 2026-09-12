/**
 * 카드 결제 승인 확인 — 아직 켜지 않았습니다.
 *
 * PG 계약이 끝나기 전에는 비밀키가 없어 이 함수가 스스로 거절합니다(503).
 * 계약 후 아래 두 값만 넣으면 그때부터 돕니다.
 *
 *   supabase secrets set PG_PROVIDER=portone
 *   supabase secrets set PG_API_SECRET=<PG 관리자에서 받은 비밀키>
 *
 * 왜 브라우저가 아니라 여기서 하는가
 *   결제창은 브라우저가 띄우지만, "정말 결제됐는지"는 브라우저에게 물으면
 *   안 됩니다. 화면 값을 고쳐 100원만 내고 6만원짜리 게시글을 얻을 수
 *   있기 때문입니다. 그래서 PG 서버에 직접 다시 물어보고(verifyWithPg),
 *   금액이 맞는지는 DB 가 한 번 더 확인합니다(settle_payment).
 *
 * 비밀키는 이 함수의 환경변수에만 둡니다. 정적 사이트에는 절대 두지 않습니다.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

/** PG 서버에 "이 결제 진짜냐"고 물어봅니다. */
interface PgResult {
  ok: boolean;
  paidAmount: number;
  orderId: string;
  paymentId: string;
  method: string;
  receiptUrl: string;
  raw: unknown;
  reason?: string;
}

/**
 * ── 여기 한 곳만 PG 마다 다릅니다 ──────────────────────────
 * 아래는 포트원(PortOne) V2 기준으로 적어 둔 것입니다.
 * 다른 PG 와 계약하시면 이 함수 하나만 그 PG 문서대로 고치면 되고,
 * 나머지(금액 확인 · 게시 처리 · 기록)는 손댈 필요가 없습니다.
 *
 * ⚠ 실제 계약 전이라 응답 모양을 실물로 확인하지 못했습니다.
 *   연결하실 때 PG 문서와 한 번 대조해 주세요 — 특히 금액 필드 이름과
 *   "결제 완료" 를 뜻하는 상태 값입니다.
 */
async function verifyWithPg(provider: string, secret: string, paymentId: string): Promise<PgResult> {
  if (provider === 'portone') {
    const res = await fetch(
      `https://api.portone.io/payments/${encodeURIComponent(paymentId)}`,
      { headers: { Authorization: `PortOne ${secret}` } },
    );
    const data = await res.json();

    if (!res.ok) {
      return { ok: false, paidAmount: 0, orderId: '', paymentId, method: '', receiptUrl: '',
               raw: data, reason: data?.message ?? `PG 조회 실패 (${res.status})` };
    }

    const paid = data?.status === 'PAID';
    return {
      ok: paid,
      paidAmount: Number(data?.amount?.total ?? 0),
      orderId: String(data?.paymentId ?? ''),   // 우리가 넘긴 주문번호
      paymentId,
      method: String(data?.method?.type ?? ''),
      receiptUrl: String(data?.receiptUrl ?? ''),
      raw: data,
      reason: paid ? undefined : `결제가 완료되지 않았습니다 (${data?.status ?? '알 수 없음'})`,
    };
  }

  throw new Error(`아직 붙이지 않은 PG 입니다: ${provider}`);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return reply({ error: 'POST 로 보내 주세요.' }, 405);

  const provider = Deno.env.get('PG_PROVIDER') ?? '';
  const secret = Deno.env.get('PG_API_SECRET') ?? '';

  // ── 계약 전에는 여기서 멈춥니다 ──
  if (!provider || !secret) {
    return reply({
      error: 'not_configured',
      message: '카드 결제가 아직 연결되지 않았습니다. 계좌 이체로 진행해 주세요.',
    }, 503);
  }

  let body: { orderId?: string; paymentId?: string };
  try {
    body = await req.json();
  } catch {
    return reply({ error: 'bad_request', message: '요청을 읽지 못했습니다.' }, 400);
  }

  const orderId = String(body.orderId ?? '').trim();
  const paymentId = String(body.paymentId ?? '').trim();
  if (!orderId || !paymentId) {
    return reply({ error: 'bad_request', message: '주문번호가 없습니다.' }, 400);
  }

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  let pg: PgResult;
  try {
    pg = await verifyWithPg(provider, secret, paymentId);
  } catch (e) {
    return reply({ error: 'pg_error', message: String((e as Error).message) }, 502);
  }

  if (!pg.ok) {
    await db.from('payments')
      .update({ status: 'failed', fail_reason: pg.reason ?? '결제가 확인되지 않았습니다.' })
      .eq('order_id', orderId);
    return reply({ error: 'not_paid', message: pg.reason ?? '결제가 확인되지 않았습니다.' }, 402);
  }

  // 주문번호가 우리가 연 건과 같은지 (남의 결제를 가져다 붙이지 못하도록)
  if (pg.orderId && pg.orderId !== orderId) {
    return reply({ error: 'mismatch', message: '주문번호가 맞지 않습니다.' }, 400);
  }

  // 금액 확인과 게시 처리는 DB 함수가 합니다 (한 잠금 안에서).
  const { data, error } = await db.rpc('settle_payment', {
    p_order: orderId,
    p_paid: pg.paidAmount,
    p_provider: provider,
    p_pid: pg.paymentId,
    p_method: pg.method,
    p_receipt: pg.receiptUrl,
    p_raw: pg.raw,
  });

  if (error) {
    return reply({ error: 'settle_failed', message: error.message }, 400);
  }

  return reply({ ok: true, payment: data });
});
