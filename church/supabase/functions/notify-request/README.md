# notify-request — 새 지원 신청 알림 메일

`requests` 표에 신청이 하나 들어오면 데이터베이스 트리거가 이 함수를 부르고,
이 함수가 담당자에게 메일을 보냅니다.

## 열어 두어야 하는 값 (Supabase 대시보드 → Edge Functions → Secrets)

| 이름 | 무엇 |
|---|---|
| `HOOK_SECRET` | Vault 의 `notify_hook_secret` 과 **같은 값** |
| `RESEND_API_KEY` | resend.com 에서 받은 열쇠 |
| `NOTIFY_TO` | 알림을 받을 주소 (쉼표로 여러 개) |
| `NOTIFY_FROM` | 보내는 주소 — 도메인 인증 전에는 비워 두세요 |

값이 하나라도 없으면 메일만 건너뛰고 **신청 접수 자체는 정상으로 끝납니다.**

## 확인

관리자 화면에서 신청을 하나 넣어 보시고 메일함을 보시면 됩니다.
안 오면 Supabase → Edge Functions → notify-request → Logs 에 이유가 남습니다.
