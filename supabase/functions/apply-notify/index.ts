// ============================================================
// 신청 접수 알림톡 (솔라피) — 인투마케팅 신청서
//
// 누가 부르나 : DB 트리거 public.mkt_apply_notify() 가 requests 에 새 줄이 들어오면
//              { id } 만 담아 부릅니다 (supabase/migrations/20261021120000_mkt_apply_alimtalk.sql).
//              브라우저는 이 함수를 부르지 않습니다.
// 무엇을 하나 : 그 신청 건을 DB 에서 «다시» 읽어, 조건이 맞으면 신청한 분 휴대폰으로
//              「신청 접수 완료」 알림톡을 1통 보내고 mkt_alimtalk_log 에 남깁니다.
//              알림톡이 실패하면 솔라피가 문자(SMS·LMS)로 대신 보냅니다 (disableSms:false).
//
// 🔴 변수 이름은 docs/알림톡-신청접수.md 의 등록 템플릿과 한 글자도 다르면 안 됩니다.
//    다르면 솔라피가 발송을 거절합니다.
// 🔴 SOLAPI_* 키나 템플릿 코드가 없으면 실제로 보내지 않고 status='skipped' 로 기록만 남깁니다.
//    그래서 심사 통과 전에 배포해 두어도 고객에게 아무것도 가지 않습니다.
//
// 솔라피 호출 방식은 intoedu/into-office 의 supabase/functions/_shared/alimtalk.ts 와 같습니다.
// ============================================================
import { createClient } from "npm:@supabase/supabase-js@2.47.10";

const SOLAPI_URL = "https://api.solapi.com/messages/v4/send-many/detail";
const KIND = "apply_received";

/* requests.kind → 고객에게 보이는 이름. 여기 없는 종류는 보내지 않습니다
   (어드민 marketing/admin 의 KINDS_OF 와 같은 묶음) */
const FIELD_KO: Record<string, string> = {
  "홈페이지": "홈페이지 제작",
  "앱": "앱 제작",
  "프로그램": "프로그램 제작",
  "SNS": "SNS 채널",
  "디자인": "그래픽 디자인",
  "영상": "영상 제작",
  "블로그·리뷰": "블로그 · 리뷰",
};

/* 같은 사람에게 하루에 너무 많이 가지 않게 — 남의 번호를 적어 넣는 장난을 막습니다 */
const DAILY_LIMIT_PER_PHONE = 5;
const DAILY_LIMIT_PER_USER = 10;

const env = (k: string) => Deno.env.get(k) ?? "";
const digits = (p: unknown) => String(p ?? "").replace(/[^0-9]/g, "");
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const providerReady = () =>
  !!(env("SOLAPI_API_KEY") && env("SOLAPI_API_SECRET") && env("SOLAPI_PFID") &&
    env("SOLAPI_SENDER") && env("ALIMTALK_TPL_APPLY"));

async function authHeader(): Promise<string> {
  const date = new Date().toISOString();
  const salt = crypto.randomUUID().replace(/-/g, "");
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(env("SOLAPI_API_SECRET")),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(date + salt));
  const signature = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `HMAC-SHA256 apiKey=${env("SOLAPI_API_KEY")}, date=${date}, salt=${salt}, signature=${signature}`;
}

// 2026년 10월 21일 오후 3:05
const fmtDate = (v: string) =>
  new Date(v).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "long", timeStyle: "short" });

// 홈페이지 신청서는 화면에서 만든 「신청 번호」가 있습니다. 없으면 신청 건 id 앞 8자리
const receiptNo = (r: { id: unknown; details: Record<string, unknown> | null }) =>
  String(r.details?.["신청 번호"] ?? "") || String(r.id).replace(/-/g, "").slice(0, 8).toUpperCase();

function sameSecret(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "METHOD" }, 405);
  if (!sameSecret(req.headers.get("x-hook-secret") ?? "", env("APPLY_HOOK_SECRET"))) {
    return json({ ok: false, error: "FORBIDDEN" }, 403);
  }

  const { id } = await req.json().catch(() => ({ id: null }));
  if (id == null || id === "") return json({ ok: false, error: "NO_ID" }, 400);

  const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });

  /* 트리거가 보낸 값은 id 하나뿐입니다. 나머지는 DB 에서 다시 읽습니다 */
  const { data: r, error } = await admin.from("requests")
    .select("id,center,kind,user_id,phone,manager_name,academy_name,details,created_at")
    .eq("id", id).maybeSingle();
  if (error || !r) return json({ ok: false, error: "NOT_FOUND" }, 404);

  const requestId = String(r.id);
  const phone = digits(r.phone);
  const details = (r.details ?? {}) as Record<string, unknown>;

  const log = (row: Record<string, unknown>) =>
    admin.from("mkt_alimtalk_log").insert({
      request_id: requestId, user_id: r.user_id ?? null, kind: KIND, to_phone: phone || null, ...row,
    });

  /* ── 보내지 않는 경우 ── */
  let skip = "";
  if (r.center !== "mkt") skip = "NOT_MKT";
  else if (!FIELD_KO[r.kind ?? ""]) skip = "KIND_NOT_COVERED";
  else if (!r.user_id) skip = "NO_USER";                                    // 관리자가 직접 넣은 건
  else if (details["접수 구분"] === "제작 자료") skip = "MATERIAL_FOLLOWUP";  // 계약 뒤 제작 자료 제출
  else if (!/^01[016789][0-9]{7,8}$/.test(phone)) skip = "NOT_MOBILE";
  if (skip) {
    await log({ status: "skipped", error: skip });
    return json({ ok: true, skipped: skip });
  }

  /* ── 하루 한도 ── */
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const [{ count: byPhone }, { count: byUser }] = await Promise.all([
    admin.from("mkt_alimtalk_log").select("id", { count: "exact", head: true })
      .eq("to_phone", phone).in("status", ["pending", "sent"]).gte("created_at", since),
    admin.from("mkt_alimtalk_log").select("id", { count: "exact", head: true })
      .eq("user_id", r.user_id).in("status", ["pending", "sent"]).gte("created_at", since),
  ]);
  if ((byPhone ?? 0) >= DAILY_LIMIT_PER_PHONE || (byUser ?? 0) >= DAILY_LIMIT_PER_USER) {
    await log({ status: "skipped", error: "DAILY_LIMIT" });
    return json({ ok: true, skipped: "DAILY_LIMIT" });
  }

  const templateId = env("ALIMTALK_TPL_APPLY");
  const variables: Record<string, string> = {
    "#{고객명}": String(r.manager_name || r.academy_name || "고객"),
    "#{신청분야}": FIELD_KO[r.kind],
    "#{접수번호}": receiptNo({ id: r.id, details }),
    "#{접수일시}": fmtDate(r.created_at),
  };

  /* ── 같은 건에 두 번 가지 않게 먼저 자리를 잡습니다 (request_id+kind 유일) ── */
  const { data: slot, error: slotErr } = await admin.from("mkt_alimtalk_log")
    .insert({ request_id: requestId, user_id: r.user_id, kind: KIND, to_phone: phone, template_id: templateId || null,
              variables, status: "pending" })
    .select("id").maybeSingle();
  if (slotErr?.code === "23505") return json({ ok: true, skipped: "DUPLICATE" });
  if (slotErr || !slot) return json({ ok: false, error: slotErr?.message ?? "LOG_FAILED" }, 500);

  const finish = (patch: Record<string, unknown>) =>
    admin.from("mkt_alimtalk_log").update(patch).eq("id", slot.id);

  if (!providerReady()) {
    await finish({ status: "skipped", error: "PROVIDER_NOT_CONFIGURED" });
    return json({ ok: true, skipped: "PROVIDER_NOT_CONFIGURED" });
  }

  let result: unknown = null;
  let failed = false;
  try {
    const res = await fetch(SOLAPI_URL, {
      method: "POST",
      headers: { Authorization: await authHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{
          to: phone,
          from: digits(env("SOLAPI_SENDER")),
          kakaoOptions: { pfId: env("SOLAPI_PFID"), templateId, variables, disableSms: false },
        }],
      }),
    });
    result = await res.json().catch(() => ({ status: res.status }));
    const failedList = (result as { failedMessageList?: unknown[] })?.failedMessageList ?? [];
    failed = !res.ok || failedList.length > 0;
  } catch (e) {
    failed = true;
    result = { error: String(e) };
  }

  await finish({
    status: failed ? "failed" : "sent",
    error: failed ? JSON.stringify(result).slice(0, 500) : null,
    response: result,
    sent_at: failed ? null : new Date().toISOString(),
  });
  return json({ ok: !failed, sent: failed ? 0 : 1 });
});
