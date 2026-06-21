import { describe, it, expect } from "vitest";
import { isPrivateIpv4, isBlockedHost, assertPublicHttpUrl } from "./url-guard";
import { AiError } from "../errors";

describe("isPrivateIpv4", () => {
  it("사설/루프백/링크로컬/CGNAT 차단", () => {
    expect(isPrivateIpv4("10.0.0.1")).toBe(true);
    expect(isPrivateIpv4("127.0.0.1")).toBe(true);
    expect(isPrivateIpv4("172.16.0.1")).toBe(true);
    expect(isPrivateIpv4("192.168.1.1")).toBe(true);
    expect(isPrivateIpv4("169.254.169.254")).toBe(true); // 클라우드 메타데이터
    expect(isPrivateIpv4("100.64.0.1")).toBe(true);
    expect(isPrivateIpv4("0.0.0.0")).toBe(true);
  });
  it("공인 IP는 통과", () => {
    expect(isPrivateIpv4("8.8.8.8")).toBe(false);
    expect(isPrivateIpv4("172.32.0.1")).toBe(false);
    expect(isPrivateIpv4("999.1.1.1")).toBe(false);
  });
});

describe("isBlockedHost", () => {
  it("내부 호스트명 차단", () => {
    expect(isBlockedHost("localhost")).toBe(true);
    expect(isBlockedHost("metadata.google.internal")).toBe(true);
    expect(isBlockedHost("foo.local")).toBe(true);
    expect(isBlockedHost("svc.internal")).toBe(true);
    expect(isBlockedHost("::1")).toBe(true);
    expect(isBlockedHost("fd00::1")).toBe(true);
  });
  it("공인 호스트 통과", () => {
    expect(isBlockedHost("blog.naver.com")).toBe(false);
    expect(isBlockedHost("www.youtube.com")).toBe(false);
  });
});

describe("assertPublicHttpUrl", () => {
  it("공인 http(s)는 통과", () => {
    expect(() => assertPublicHttpUrl("https://blog.naver.com/x")).not.toThrow();
  });
  it("사설/메타데이터/localhost는 unsupported", () => {
    for (const u of [
      "http://127.0.0.1/x",
      "http://169.254.169.254/latest/meta-data/",
      "http://localhost:3000/x",
      "http://10.0.0.5/internal",
    ]) {
      expect(() => assertPublicHttpUrl(u)).toThrowError(AiError);
    }
  });
  it("비 http 스킴 차단", () => {
    expect(() => assertPublicHttpUrl("file:///etc/passwd")).toThrowError(AiError);
    expect(() => assertPublicHttpUrl("ftp://x.com")).toThrowError(AiError);
  });
});
