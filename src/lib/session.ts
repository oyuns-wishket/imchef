import { SessionOptions } from "iron-session";
import { SessionData } from "./types";

export const sessionOptions: SessionOptions = {
  password:
    process.env.SESSION_SECRET ||
    "complex_password_at_least_32_characters_long_for_dev_only",
  cookieName: "imchef_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
};

declare module "iron-session" {
  // iron-session 세션 타입 보강(모듈 augmentation 표준 패턴).
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface IronSessionData extends SessionData {}
}
