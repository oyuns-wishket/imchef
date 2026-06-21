/**
 * SSRF 1차 방어: 서버가 사용자 제공 URL을 fetch하기 전 내부/사설 대상을 차단한다.
 *
 * 루프백·링크로컬·사설 IP 리터럴, 클라우드 메타데이터 호스트, localhost/.internal/.local을
 * 막는다. (DNS rebinding 같은 고급 우회는 범위 밖 — 인프라 레벨 egress 통제와 병행 가정.)
 * 순수 문자열 판정이라 단위 테스트 가능.
 */
import { AiError } from "../errors";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata",
  "instance-data",
]);

export function isPrivateIpv4(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if ([a, b, Number(m[3]), Number(m[4])].some((n) => n > 255)) return false;
  return (
    a === 0 || // 0.0.0.0/8
    a === 10 || // 10/8 사설
    a === 127 || // 루프백
    (a === 100 && b >= 64 && b <= 127) || // 100.64/10 CGNAT
    (a === 169 && b === 254) || // 링크로컬 (클라우드 메타데이터 169.254.169.254)
    (a === 172 && b >= 16 && b <= 31) || // 172.16/12 사설
    (a === 192 && b === 168) // 192.168/16 사설
  );
}

export function isBlockedHost(rawHost: string): boolean {
  const host = rawHost.toLowerCase().replace(/\.$/, "").replace(/^\[|\]$/g, "");
  if (!host) return true;
  if (BLOCKED_HOSTNAMES.has(host)) return true;
  if (
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    return true;
  }
  if (isPrivateIpv4(host)) return true;
  // IPv6 루프백/ULA/링크로컬
  if (host === "::1" || host === "::" ) return true;
  if (/^f[cd][0-9a-f]{2}:/i.test(host) || /^fe80:/i.test(host)) return true;
  return false;
}

/** http/https + 공인 호스트가 아니면 unsupported AiError. */
export function assertPublicHttpUrl(rawUrl: string): void {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    throw new AiError("unsupported", "잘못된 URL");
  }
  if (!["http:", "https:"].includes(u.protocol)) {
    throw new AiError("unsupported", "미지원 스킴");
  }
  if (isBlockedHost(u.hostname)) {
    throw new AiError("unsupported", "내부/사설 주소는 분석할 수 없습니다");
  }
}
