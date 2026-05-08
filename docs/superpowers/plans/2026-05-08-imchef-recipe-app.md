# imchef - Recipe Management App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a multi-user recipe management web app where users create, view, edit, and delete their own recipes with an optimized recipe-writing UI.

**Architecture:** Next.js 15 App Router monolith with API Routes for the backend, Prisma ORM with SQLite for persistence, and iron-session for cookie-based auth. Images stored on the local filesystem under `public/uploads/`. All UI styled with Tailwind CSS in a minimal, muted-tone design.

**Tech Stack:** Next.js 15, React 19, TypeScript, Prisma, SQLite, iron-session, bcryptjs, Tailwind CSS

---

## File Structure

```
imchef/
├── prisma/
│   └── schema.prisma
├── public/
│   └── uploads/              # recipe images (gitignored)
├── src/
│   ├── app/
│   │   ├── layout.tsx        # root layout with Header
│   │   ├── page.tsx          # home: all recipes list
│   │   ├── globals.css       # tailwind + custom styles
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── signup/
│   │   │   └── page.tsx
│   │   ├── recipes/
│   │   │   ├── new/
│   │   │   │   └── page.tsx  # create recipe
│   │   │   └── [id]/
│   │   │       ├── page.tsx  # recipe detail
│   │   │       └── edit/
│   │   │           └── page.tsx
│   │   ├── my-recipes/
│   │   │   └── page.tsx
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── signup/route.ts
│   │       │   ├── login/route.ts
│   │       │   ├── logout/route.ts
│   │       │   ├── me/route.ts
│   │       │   └── verify-password/route.ts
│   │       ├── recipes/
│   │       │   ├── route.ts        # GET list, POST create
│   │       │   └── [id]/
│   │       │       └── route.ts    # GET one, PUT update, DELETE
│   │       └── upload/
│   │           └── route.ts        # POST image upload
│   ├── components/
│   │   ├── Header.tsx
│   │   ├── RecipeCard.tsx
│   │   ├── RecipeForm.tsx
│   │   ├── IngredientInput.tsx
│   │   ├── StepInput.tsx
│   │   ├── ImageUploader.tsx
│   │   └── PasswordModal.tsx
│   └── lib/
│       ├── prisma.ts         # singleton Prisma client
│       ├── session.ts        # iron-session config
│       └── types.ts          # shared TypeScript types
├── .gitignore
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── next.config.ts
```

---

## Task 1: Project Scaffolding & Configuration

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `.gitignore`, `src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx`

- [ ] **Step 1: Initialize Next.js project**

```bash
cd /Users/manager/imchef
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --yes
```

- [ ] **Step 2: Install dependencies**

```bash
cd /Users/manager/imchef
npm install prisma @prisma/client iron-session bcryptjs uuid
npm install -D @types/bcryptjs @types/uuid
```

- [ ] **Step 3: Update `.gitignore` to exclude uploads**

Append to `.gitignore`:

```
# Recipe image uploads
public/uploads/*
!public/uploads/.gitkeep
```

- [ ] **Step 4: Create uploads directory with gitkeep**

```bash
mkdir -p public/uploads
touch public/uploads/.gitkeep
```

- [ ] **Step 5: Set up the muted, minimal color palette in `tailwind.config.ts`**

Replace `tailwind.config.ts` content:

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        stone: {
          50: "#fafaf9",
          100: "#f5f5f4",
          200: "#e7e5e4",
          300: "#d6d3d1",
          400: "#a8a29e",
          500: "#78716c",
          600: "#57534e",
          700: "#44403c",
          800: "#292524",
          900: "#1c1917",
          950: "#0c0a09",
        },
      },
      fontFamily: {
        sans: [
          "Pretendard",
          "-apple-system",
          "BlinkMacSystemFont",
          "system-ui",
          "Helvetica Neue",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
export default config;
```

- [ ] **Step 6: Set up `globals.css` with base styles**

Replace `src/app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@import url("https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css");

@layer base {
  body {
    @apply bg-stone-50 text-stone-800 antialiased;
  }
}

@layer components {
  .btn-primary {
    @apply bg-stone-800 text-stone-50 px-5 py-2.5 rounded-lg text-sm font-medium
           hover:bg-stone-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed;
  }

  .btn-secondary {
    @apply bg-stone-200 text-stone-700 px-5 py-2.5 rounded-lg text-sm font-medium
           hover:bg-stone-300 transition-colors;
  }

  .btn-danger {
    @apply bg-red-50 text-red-600 px-5 py-2.5 rounded-lg text-sm font-medium
           hover:bg-red-100 transition-colors;
  }

  .input-field {
    @apply w-full px-4 py-2.5 bg-white border border-stone-200 rounded-lg text-sm
           placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-300
           focus:border-transparent transition-all;
  }

  .card {
    @apply bg-white rounded-2xl border border-stone-100 overflow-hidden
           hover:shadow-md transition-shadow duration-300;
  }
}
```

- [ ] **Step 7: Create minimal root layout**

Replace `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "imchef",
  description: "My recipe collection",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
```

- [ ] **Step 8: Create placeholder home page**

Replace `src/app/page.tsx`:

```tsx
export default function Home() {
  return (
    <main className="max-w-5xl mx-auto px-4 py-20">
      <h1 className="text-3xl font-bold text-stone-900 tracking-tight">
        imchef
      </h1>
      <p className="mt-2 text-stone-500">레시피를 기록하고 관리하세요.</p>
    </main>
  );
}
```

- [ ] **Step 9: Verify dev server starts**

```bash
cd /Users/manager/imchef
npm run dev
```

Expected: Server starts on http://localhost:3000, shows "imchef" heading.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js project with Tailwind and dependencies"
```

---

## Task 2: Database Schema & Prisma Setup

**Files:**
- Create: `prisma/schema.prisma`, `src/lib/prisma.ts`, `src/lib/types.ts`

- [ ] **Step 1: Initialize Prisma with SQLite**

```bash
cd /Users/manager/imchef
npx prisma init --datasource-provider sqlite
```

- [ ] **Step 2: Define the database schema**

Replace `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}

model User {
  id        String   @id @default(uuid())
  loginId   String   @unique
  password  String
  nickname  String
  createdAt DateTime @default(now())
  recipes   Recipe[]
}

model Recipe {
  id          String             @id @default(uuid())
  title       String
  description String?
  servings    Int                @default(1)
  cookTime    Int?
  difficulty  String             @default("normal")
  userId      String
  user        User               @relation(fields: [userId], references: [id])
  ingredients RecipeIngredient[]
  steps       RecipeStep[]
  images      RecipeImage[]
  createdAt   DateTime           @default(now())
  updatedAt   DateTime           @updatedAt
}

model RecipeIngredient {
  id       String @id @default(uuid())
  name     String
  amount   String
  unit     String
  order    Int    @default(0)
  recipeId String
  recipe   Recipe @relation(fields: [recipeId], references: [id], onDelete: Cascade)
}

model RecipeStep {
  id       String @id @default(uuid())
  content  String
  order    Int
  recipeId String
  recipe   Recipe @relation(fields: [recipeId], references: [id], onDelete: Cascade)
}

model RecipeImage {
  id       String @id @default(uuid())
  url      String
  order    Int    @default(0)
  recipeId String
  recipe   Recipe @relation(fields: [recipeId], references: [id], onDelete: Cascade)
}
```

- [ ] **Step 3: Run initial migration**

```bash
cd /Users/manager/imchef
npx prisma migrate dev --name init
```

Expected: Migration created successfully, `prisma/dev.db` generated.

- [ ] **Step 4: Create Prisma singleton client**

Create `src/lib/prisma.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

- [ ] **Step 5: Create shared types**

Create `src/lib/types.ts`:

```ts
export interface SessionData {
  userId: string;
  loginId: string;
  nickname: string;
}

export interface RecipeFormData {
  title: string;
  description: string;
  servings: number;
  cookTime: number | null;
  difficulty: "easy" | "normal" | "hard";
  ingredients: { name: string; amount: string; unit: string }[];
  steps: { content: string; order: number }[];
  imageUrls: string[];
}
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add Prisma schema with User, Recipe, Ingredient, Step, Image models"
```

---

## Task 3: Session & Auth Configuration

**Files:**
- Create: `src/lib/session.ts`
- Create: `src/app/api/auth/signup/route.ts`
- Create: `src/app/api/auth/login/route.ts`
- Create: `src/app/api/auth/logout/route.ts`
- Create: `src/app/api/auth/me/route.ts`
- Create: `src/app/api/auth/verify-password/route.ts`

- [ ] **Step 1: Create session configuration**

Create `src/lib/session.ts`:

```ts
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
  interface IronSessionData extends SessionData {}
}
```

- [ ] **Step 2: Create signup API route**

Create `src/app/api/auth/signup/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { sessionOptions } from "@/lib/session";
import { SessionData } from "@/lib/types";

export async function POST(req: NextRequest) {
  const { loginId, password, nickname } = await req.json();

  if (!loginId || !password || !nickname) {
    return NextResponse.json(
      { error: "모든 필드를 입력해주세요." },
      { status: 400 }
    );
  }

  if (loginId.length < 4 || loginId.length > 20) {
    return NextResponse.json(
      { error: "아이디는 4~20자로 입력해주세요." },
      { status: 400 }
    );
  }

  if (password.length < 6) {
    return NextResponse.json(
      { error: "비밀번호는 6자 이상으로 입력해주세요." },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { loginId } });
  if (existing) {
    return NextResponse.json(
      { error: "이미 사용 중인 아이디입니다." },
      { status: 409 }
    );
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { loginId, password: hashedPassword, nickname },
  });

  const session = await getIronSession<SessionData>(
    await cookies(),
    sessionOptions
  );
  session.userId = user.id;
  session.loginId = user.loginId;
  session.nickname = user.nickname;
  await session.save();

  return NextResponse.json({
    id: user.id,
    loginId: user.loginId,
    nickname: user.nickname,
  });
}
```

- [ ] **Step 3: Create login API route**

Create `src/app/api/auth/login/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { sessionOptions } from "@/lib/session";
import { SessionData } from "@/lib/types";

export async function POST(req: NextRequest) {
  const { loginId, password } = await req.json();

  if (!loginId || !password) {
    return NextResponse.json(
      { error: "아이디와 비밀번호를 입력해주세요." },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({ where: { loginId } });
  if (!user) {
    return NextResponse.json(
      { error: "아이디 또는 비밀번호가 일치하지 않습니다." },
      { status: 401 }
    );
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return NextResponse.json(
      { error: "아이디 또는 비밀번호가 일치하지 않습니다." },
      { status: 401 }
    );
  }

  const session = await getIronSession<SessionData>(
    await cookies(),
    sessionOptions
  );
  session.userId = user.id;
  session.loginId = user.loginId;
  session.nickname = user.nickname;
  await session.save();

  return NextResponse.json({
    id: user.id,
    loginId: user.loginId,
    nickname: user.nickname,
  });
}
```

- [ ] **Step 4: Create logout API route**

Create `src/app/api/auth/logout/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions } from "@/lib/session";
import { SessionData } from "@/lib/types";

export async function POST() {
  const session = await getIronSession<SessionData>(
    await cookies(),
    sessionOptions
  );
  session.destroy();
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Create me (current user) API route**

Create `src/app/api/auth/me/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions } from "@/lib/session";
import { SessionData } from "@/lib/types";

export async function GET() {
  const session = await getIronSession<SessionData>(
    await cookies(),
    sessionOptions
  );

  if (!session.userId) {
    return NextResponse.json({ user: null });
  }

  return NextResponse.json({
    user: {
      id: session.userId,
      loginId: session.loginId,
      nickname: session.nickname,
    },
  });
}
```

- [ ] **Step 6: Create verify-password API route**

This is used when editing/deleting a recipe to re-confirm the user's identity.

Create `src/app/api/auth/verify-password/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { sessionOptions } from "@/lib/session";
import { SessionData } from "@/lib/types";

export async function POST(req: NextRequest) {
  const session = await getIronSession<SessionData>(
    await cookies(),
    sessionOptions
  );

  if (!session.userId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { password } = await req.json();

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
  });

  if (!user) {
    return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return NextResponse.json({ error: "비밀번호가 일치하지 않습니다." }, { status: 401 });
  }

  return NextResponse.json({ verified: true });
}
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add auth API routes (signup, login, logout, me, verify-password)"
```

---

## Task 4: Auth UI (Login & Signup Pages)

**Files:**
- Create: `src/app/login/page.tsx`
- Create: `src/app/signup/page.tsx`

- [ ] **Step 1: Create login page**

Create `src/app/login/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loginId, password }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-stone-900 text-center mb-8">
          imchef
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5">
              아이디
            </label>
            <input
              type="text"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              className="input-field"
              placeholder="아이디를 입력하세요"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5">
              비밀번호
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              placeholder="비밀번호를 입력하세요"
              required
            />
          </div>
          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-stone-400">
          계정이 없으신가요?{" "}
          <Link href="/signup" className="text-stone-600 hover:text-stone-800 underline">
            회원가입
          </Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create signup page**

Create `src/app/signup/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loginId, password, nickname }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-stone-900 text-center mb-8">
          imchef
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5">
              아이디
            </label>
            <input
              type="text"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              className="input-field"
              placeholder="4~20자"
              required
              minLength={4}
              maxLength={20}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5">
              비밀번호
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              placeholder="6자 이상"
              required
              minLength={6}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5">
              닉네임
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="input-field"
              placeholder="닉네임을 입력하세요"
              required
            />
          </div>
          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "가입 중..." : "회원가입"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-stone-400">
          이미 계정이 있으신가요?{" "}
          <Link href="/login" className="text-stone-600 hover:text-stone-800 underline">
            로그인
          </Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify login and signup pages render**

```bash
cd /Users/manager/imchef && npm run dev
```

Navigate to http://localhost:3000/login and http://localhost:3000/signup. Verify forms render with minimal stone-tone styling.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add login and signup pages"
```

---

## Task 5: Header & Layout

**Files:**
- Create: `src/components/Header.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Create Header component**

Create `src/components/Header.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface User {
  id: string;
  loginId: string;
  nickname: string;
}

export default function Header() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => setUser(data.user));
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-50 bg-stone-50/80 backdrop-blur-md border-b border-stone-100">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link
          href="/"
          className="text-lg font-bold text-stone-900 tracking-tight"
        >
          imchef
        </Link>

        <nav className="flex items-center gap-3">
          {user ? (
            <>
              <Link
                href="/recipes/new"
                className="text-sm text-stone-500 hover:text-stone-800 transition-colors"
              >
                새 레시피
              </Link>
              <Link
                href="/my-recipes"
                className="text-sm text-stone-500 hover:text-stone-800 transition-colors"
              >
                내 레시피
              </Link>
              <span className="text-sm text-stone-400">{user.nickname}</span>
              <button
                onClick={handleLogout}
                className="text-sm text-stone-400 hover:text-stone-600 transition-colors"
              >
                로그아웃
              </button>
            </>
          ) : (
            <Link href="/login" className="btn-primary text-xs">
              로그인
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Update root layout to include Header**

Replace `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import Header from "@/components/Header";
import "./globals.css";

export const metadata: Metadata = {
  title: "imchef",
  description: "My recipe collection",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="min-h-screen">
        <Header />
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Verify header renders with login state**

Run dev server. Check that header shows "로그인" button when not logged in, and shows nav links when logged in.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add Header component with auth-aware navigation"
```

---

## Task 6: Image Upload API

**Files:**
- Create: `src/app/api/upload/route.ts`
- Modify: `next.config.ts`

- [ ] **Step 1: Configure Next.js for larger file uploads**

Replace `next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
```

- [ ] **Step 2: Create image upload API route**

Create `src/app/api/upload/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { writeFile } from "fs/promises";
import { join } from "path";
import { v4 as uuid } from "uuid";
import { sessionOptions } from "@/lib/session";
import { SessionData } from "@/lib/types";

export async function POST(req: NextRequest) {
  const session = await getIronSession<SessionData>(
    await cookies(),
    sessionOptions
  );

  if (!session.userId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json(
      { error: "JPG, PNG, WebP, GIF 형식만 지원합니다." },
      { status: 400 }
    );
  }

  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    return NextResponse.json(
      { error: "파일 크기는 5MB 이하로 업로드해주세요." },
      { status: 400 }
    );
  }

  const ext = file.name.split(".").pop() || "jpg";
  const filename = `${uuid()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const uploadDir = join(process.cwd(), "public", "uploads");
  await writeFile(join(uploadDir, filename), bytes);

  return NextResponse.json({ url: `/uploads/${filename}` });
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add image upload API with validation"
```

---

## Task 7: Recipe CRUD API

**Files:**
- Create: `src/app/api/recipes/route.ts`
- Create: `src/app/api/recipes/[id]/route.ts`

- [ ] **Step 1: Create recipe list/create API**

Create `src/app/api/recipes/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { sessionOptions } from "@/lib/session";
import { SessionData } from "@/lib/types";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  const recipes = await prisma.recipe.findMany({
    where: userId ? { userId } : undefined,
    include: {
      user: { select: { nickname: true } },
      images: { orderBy: { order: "asc" }, take: 1 },
      _count: { select: { ingredients: true, steps: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(recipes);
}

export async function POST(req: NextRequest) {
  const session = await getIronSession<SessionData>(
    await cookies(),
    sessionOptions
  );

  if (!session.userId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = await req.json();
  const { title, description, servings, cookTime, difficulty, ingredients, steps, imageUrls } = body;

  if (!title || !ingredients?.length || !steps?.length) {
    return NextResponse.json(
      { error: "제목, 재료, 조리 순서는 필수입니다." },
      { status: 400 }
    );
  }

  const recipe = await prisma.recipe.create({
    data: {
      title,
      description: description || null,
      servings: servings || 1,
      cookTime: cookTime || null,
      difficulty: difficulty || "normal",
      userId: session.userId,
      ingredients: {
        create: ingredients.map(
          (ing: { name: string; amount: string; unit: string }, i: number) => ({
            name: ing.name,
            amount: ing.amount,
            unit: ing.unit,
            order: i,
          })
        ),
      },
      steps: {
        create: steps.map(
          (step: { content: string }, i: number) => ({
            content: step.content,
            order: i + 1,
          })
        ),
      },
      images: {
        create: (imageUrls || []).map((url: string, i: number) => ({
          url,
          order: i,
        })),
      },
    },
    include: {
      ingredients: true,
      steps: { orderBy: { order: "asc" } },
      images: { orderBy: { order: "asc" } },
    },
  });

  return NextResponse.json(recipe, { status: 201 });
}
```

- [ ] **Step 2: Create recipe detail/update/delete API**

Create `src/app/api/recipes/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { sessionOptions } from "@/lib/session";
import { SessionData } from "@/lib/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const recipe = await prisma.recipe.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, nickname: true, loginId: true } },
      ingredients: { orderBy: { order: "asc" } },
      steps: { orderBy: { order: "asc" } },
      images: { orderBy: { order: "asc" } },
    },
  });

  if (!recipe) {
    return NextResponse.json({ error: "레시피를 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json(recipe);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getIronSession<SessionData>(
    await cookies(),
    sessionOptions
  );

  if (!session.userId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const recipe = await prisma.recipe.findUnique({ where: { id } });
  if (!recipe) {
    return NextResponse.json({ error: "레시피를 찾을 수 없습니다." }, { status: 404 });
  }
  if (recipe.userId !== session.userId) {
    return NextResponse.json({ error: "수정 권한이 없습니다." }, { status: 403 });
  }

  const body = await req.json();
  const { title, description, servings, cookTime, difficulty, ingredients, steps, imageUrls } = body;

  await prisma.$transaction([
    prisma.recipeIngredient.deleteMany({ where: { recipeId: id } }),
    prisma.recipeStep.deleteMany({ where: { recipeId: id } }),
    prisma.recipeImage.deleteMany({ where: { recipeId: id } }),
  ]);

  const updated = await prisma.recipe.update({
    where: { id },
    data: {
      title,
      description: description || null,
      servings: servings || 1,
      cookTime: cookTime || null,
      difficulty: difficulty || "normal",
      ingredients: {
        create: ingredients.map(
          (ing: { name: string; amount: string; unit: string }, i: number) => ({
            name: ing.name,
            amount: ing.amount,
            unit: ing.unit,
            order: i,
          })
        ),
      },
      steps: {
        create: steps.map(
          (step: { content: string }, i: number) => ({
            content: step.content,
            order: i + 1,
          })
        ),
      },
      images: {
        create: (imageUrls || []).map((url: string, i: number) => ({
          url,
          order: i,
        })),
      },
    },
    include: {
      ingredients: { orderBy: { order: "asc" } },
      steps: { orderBy: { order: "asc" } },
      images: { orderBy: { order: "asc" } },
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getIronSession<SessionData>(
    await cookies(),
    sessionOptions
  );

  if (!session.userId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const recipe = await prisma.recipe.findUnique({ where: { id } });
  if (!recipe) {
    return NextResponse.json({ error: "레시피를 찾을 수 없습니다." }, { status: 404 });
  }
  if (recipe.userId !== session.userId) {
    return NextResponse.json({ error: "삭제 권한이 없습니다." }, { status: 403 });
  }

  await prisma.recipe.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add recipe CRUD API routes"
```

---

## Task 8: Recipe Form Components

**Files:**
- Create: `src/components/IngredientInput.tsx`
- Create: `src/components/StepInput.tsx`
- Create: `src/components/ImageUploader.tsx`
- Create: `src/components/RecipeForm.tsx`

- [ ] **Step 1: Create IngredientInput component**

Create `src/components/IngredientInput.tsx`:

```tsx
"use client";

interface Ingredient {
  name: string;
  amount: string;
  unit: string;
}

interface Props {
  ingredients: Ingredient[];
  onChange: (ingredients: Ingredient[]) => void;
}

const UNITS = ["g", "kg", "ml", "L", "개", "큰술", "작은술", "컵", "줌", "꼬집", "적당량"];

export default function IngredientInput({ ingredients, onChange }: Props) {
  function add() {
    onChange([...ingredients, { name: "", amount: "", unit: "g" }]);
  }

  function remove(index: number) {
    onChange(ingredients.filter((_, i) => i !== index));
  }

  function update(index: number, field: keyof Ingredient, value: string) {
    const updated = ingredients.map((ing, i) =>
      i === index ? { ...ing, [field]: value } : ing
    );
    onChange(updated);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-stone-700">재료</label>
        <button type="button" onClick={add} className="text-xs text-stone-500 hover:text-stone-700">
          + 추가
        </button>
      </div>

      {ingredients.map((ing, i) => (
        <div key={i} className="flex gap-2 items-start">
          <input
            type="text"
            value={ing.name}
            onChange={(e) => update(i, "name", e.target.value)}
            placeholder="재료명"
            className="input-field flex-[2]"
          />
          <input
            type="text"
            value={ing.amount}
            onChange={(e) => update(i, "amount", e.target.value)}
            placeholder="양"
            className="input-field flex-1"
          />
          <select
            value={ing.unit}
            onChange={(e) => update(i, "unit", e.target.value)}
            className="input-field flex-1"
          >
            {UNITS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
          {ingredients.length > 1 && (
            <button
              type="button"
              onClick={() => remove(i)}
              className="mt-2.5 text-stone-300 hover:text-red-400 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create StepInput component**

Create `src/components/StepInput.tsx`:

```tsx
"use client";

interface Step {
  content: string;
}

interface Props {
  steps: Step[];
  onChange: (steps: Step[]) => void;
}

export default function StepInput({ steps, onChange }: Props) {
  function add() {
    onChange([...steps, { content: "" }]);
  }

  function remove(index: number) {
    onChange(steps.filter((_, i) => i !== index));
  }

  function update(index: number, content: string) {
    onChange(steps.map((s, i) => (i === index ? { content } : s)));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-stone-700">조리 순서</label>
        <button type="button" onClick={add} className="text-xs text-stone-500 hover:text-stone-700">
          + 추가
        </button>
      </div>

      {steps.map((step, i) => (
        <div key={i} className="flex gap-3 items-start">
          <span className="flex-shrink-0 w-7 h-7 rounded-full bg-stone-200 text-stone-600 text-xs font-medium flex items-center justify-center mt-2">
            {i + 1}
          </span>
          <textarea
            value={step.content}
            onChange={(e) => update(i, e.target.value)}
            placeholder={`${i + 1}단계를 설명해주세요`}
            rows={2}
            className="input-field flex-1 resize-none"
          />
          {steps.length > 1 && (
            <button
              type="button"
              onClick={() => remove(i)}
              className="mt-2.5 text-stone-300 hover:text-red-400 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create ImageUploader component**

Create `src/components/ImageUploader.tsx`:

```tsx
"use client";

import { useState, useRef } from "react";
import Image from "next/image";

interface Props {
  images: string[];
  onChange: (images: string[]) => void;
  maxImages?: number;
}

export default function ImageUploader({ images, onChange, maxImages = 3 }: Props) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/upload", { method: "POST", body: formData });
    if (res.ok) {
      const { url } = await res.json();
      onChange([...images, url]);
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  function remove(index: number) {
    onChange(images.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-stone-700">
        사진 ({images.length}/{maxImages})
      </label>
      <div className="flex gap-3 flex-wrap">
        {images.map((url, i) => (
          <div key={i} className="relative w-28 h-28 rounded-xl overflow-hidden bg-stone-100 group">
            <Image src={url} alt="" fill className="object-cover" />
            <button
              type="button"
              onClick={() => remove(i)}
              className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/50 rounded-full text-white
                         flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        ))}
        {images.length < maxImages && (
          <label
            className="w-28 h-28 rounded-xl border-2 border-dashed border-stone-200
                       flex flex-col items-center justify-center cursor-pointer
                       hover:border-stone-400 transition-colors text-stone-400"
          >
            {uploading ? (
              <span className="text-xs">업로드중...</span>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-xs">사진 추가</span>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleUpload}
              className="hidden"
              disabled={uploading}
            />
          </label>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create RecipeForm component**

Create `src/components/RecipeForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import IngredientInput from "./IngredientInput";
import StepInput from "./StepInput";
import ImageUploader from "./ImageUploader";

interface Ingredient {
  name: string;
  amount: string;
  unit: string;
}

interface Step {
  content: string;
}

interface RecipeData {
  title: string;
  description: string;
  servings: number;
  cookTime: number | null;
  difficulty: string;
  ingredients: Ingredient[];
  steps: Step[];
  imageUrls: string[];
}

interface Props {
  initialData?: RecipeData;
  recipeId?: string;
}

const DIFFICULTIES = [
  { value: "easy", label: "쉬움" },
  { value: "normal", label: "보통" },
  { value: "hard", label: "어려움" },
];

export default function RecipeForm({ initialData, recipeId }: Props) {
  const router = useRouter();
  const isEditing = !!recipeId;

  const [title, setTitle] = useState(initialData?.title || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [servings, setServings] = useState(initialData?.servings || 1);
  const [cookTime, setCookTime] = useState<number | "">(initialData?.cookTime || "");
  const [difficulty, setDifficulty] = useState(initialData?.difficulty || "normal");
  const [ingredients, setIngredients] = useState<Ingredient[]>(
    initialData?.ingredients || [{ name: "", amount: "", unit: "g" }]
  );
  const [steps, setSteps] = useState<Step[]>(
    initialData?.steps || [{ content: "" }]
  );
  const [imageUrls, setImageUrls] = useState<string[]>(initialData?.imageUrls || []);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const validIngredients = ingredients.filter((ing) => ing.name.trim());
    const validSteps = steps.filter((step) => step.content.trim());

    if (!title.trim()) {
      setError("레시피 제목을 입력해주세요.");
      return;
    }
    if (validIngredients.length === 0) {
      setError("재료를 최소 1개 이상 입력해주세요.");
      return;
    }
    if (validSteps.length === 0) {
      setError("조리 순서를 최소 1단계 이상 입력해주세요.");
      return;
    }

    setLoading(true);

    const body = {
      title: title.trim(),
      description: description.trim(),
      servings,
      cookTime: cookTime || null,
      difficulty,
      ingredients: validIngredients,
      steps: validSteps,
      imageUrls,
    };

    const url = isEditing ? `/api/recipes/${recipeId}` : "/api/recipes";
    const method = isEditing ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "저장에 실패했습니다.");
      setLoading(false);
      return;
    }

    const recipe = await res.json();
    router.push(`/recipes/${recipe.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <ImageUploader images={imageUrls} onChange={setImageUrls} />

      <div>
        <label className="text-sm font-medium text-stone-700">레시피 제목</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="예: 엄마표 된장찌개"
          className="input-field mt-1.5"
          required
        />
      </div>

      <div>
        <label className="text-sm font-medium text-stone-700">
          소개 <span className="text-stone-400 font-normal">(선택)</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="이 레시피에 대해 간단히 설명해주세요"
          rows={3}
          className="input-field mt-1.5 resize-none"
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="text-sm font-medium text-stone-700">인분</label>
          <div className="flex items-center gap-2 mt-1.5">
            <button
              type="button"
              onClick={() => setServings(Math.max(1, servings - 1))}
              className="w-9 h-9 rounded-lg bg-stone-100 text-stone-600 hover:bg-stone-200 transition-colors flex items-center justify-center"
            >
              -
            </button>
            <span className="text-sm font-medium text-stone-800 w-8 text-center">
              {servings}
            </span>
            <button
              type="button"
              onClick={() => setServings(servings + 1)}
              className="w-9 h-9 rounded-lg bg-stone-100 text-stone-600 hover:bg-stone-200 transition-colors flex items-center justify-center"
            >
              +
            </button>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-stone-700">조리시간</label>
          <div className="flex items-center gap-2 mt-1.5">
            <input
              type="number"
              value={cookTime}
              onChange={(e) => setCookTime(e.target.value ? parseInt(e.target.value) : "")}
              placeholder="30"
              className="input-field w-20"
              min={0}
            />
            <span className="text-sm text-stone-400">분</span>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-stone-700">난이도</label>
          <div className="flex gap-1.5 mt-1.5">
            {DIFFICULTIES.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => setDifficulty(d.value)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  difficulty === d.value
                    ? "bg-stone-800 text-white"
                    : "bg-stone-100 text-stone-500 hover:bg-stone-200"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <hr className="border-stone-100" />

      <IngredientInput ingredients={ingredients} onChange={setIngredients} />

      <hr className="border-stone-100" />

      <StepInput steps={steps} onChange={setSteps} />

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      <div className="flex justify-end gap-3 pt-4">
        <button type="button" onClick={() => router.back()} className="btn-secondary">
          취소
        </button>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? "저장 중..." : isEditing ? "수정하기" : "레시피 등록"}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add recipe form components (ingredients, steps, image uploader)"
```

---

## Task 9: Recipe Create & Edit Pages

**Files:**
- Create: `src/app/recipes/new/page.tsx`
- Create: `src/app/recipes/[id]/edit/page.tsx`

- [ ] **Step 1: Create new recipe page**

Create `src/app/recipes/new/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import RecipeForm from "@/components/RecipeForm";

export default function NewRecipePage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (!data.user) router.push("/login");
        else setAuthorized(true);
      });
  }, [router]);

  if (!authorized) return null;

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-xl font-bold text-stone-900 mb-8">새 레시피</h1>
      <RecipeForm />
    </main>
  );
}
```

- [ ] **Step 2: Create edit recipe page**

Create `src/app/recipes/[id]/edit/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import RecipeForm from "@/components/RecipeForm";

interface RecipeData {
  title: string;
  description: string;
  servings: number;
  cookTime: number | null;
  difficulty: string;
  ingredients: { name: string; amount: string; unit: string }[];
  steps: { content: string }[];
  images: { url: string }[];
  userId: string;
}

export default function EditRecipePage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [recipe, setRecipe] = useState<RecipeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [meRes, recipeRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch(`/api/recipes/${id}`),
      ]);

      const me = await meRes.json();
      if (!me.user) {
        router.push("/login");
        return;
      }

      const data = await recipeRes.json();
      if (data.userId !== me.user.id) {
        router.push(`/recipes/${id}`);
        return;
      }

      setRecipe(data);
      setLoading(false);
    }
    load();
  }, [id, router]);

  if (loading || !recipe) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-10">
        <div className="text-stone-400 text-sm">불러오는 중...</div>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-xl font-bold text-stone-900 mb-8">레시피 수정</h1>
      <RecipeForm
        recipeId={id}
        initialData={{
          title: recipe.title,
          description: recipe.description || "",
          servings: recipe.servings,
          cookTime: recipe.cookTime,
          difficulty: recipe.difficulty,
          ingredients: recipe.ingredients,
          steps: recipe.steps,
          imageUrls: recipe.images.map((img) => img.url),
        }}
      />
    </main>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add new and edit recipe pages"
```

---

## Task 10: Recipe Detail Page with Password Verification

**Files:**
- Create: `src/components/PasswordModal.tsx`
- Create: `src/app/recipes/[id]/page.tsx`

- [ ] **Step 1: Create PasswordModal component**

Create `src/components/PasswordModal.tsx`:

```tsx
"use client";

import { useState } from "react";

interface Props {
  action: "edit" | "delete";
  onConfirm: () => void;
  onCancel: () => void;
}

export default function PasswordModal({ action, onConfirm, onCancel }: Props) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/verify-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error);
      setLoading(false);
      return;
    }

    onConfirm();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 shadow-xl">
        <h2 className="text-lg font-bold text-stone-900 mb-2">
          {action === "delete" ? "레시피 삭제" : "레시피 수정"}
        </h2>
        <p className="text-sm text-stone-500 mb-5">
          본인 확인을 위해 비밀번호를 입력해주세요.
        </p>
        <form onSubmit={handleVerify} className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호"
            className="input-field"
            autoFocus
            required
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={onCancel} className="btn-secondary">
              취소
            </button>
            <button
              type="submit"
              className={action === "delete" ? "btn-danger" : "btn-primary"}
              disabled={loading}
            >
              {loading
                ? "확인 중..."
                : action === "delete"
                  ? "삭제"
                  : "수정"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create recipe detail page**

Create `src/app/recipes/[id]/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";
import PasswordModal from "@/components/PasswordModal";

interface Recipe {
  id: string;
  title: string;
  description: string | null;
  servings: number;
  cookTime: number | null;
  difficulty: string;
  user: { id: string; nickname: string };
  ingredients: { id: string; name: string; amount: string; unit: string }[];
  steps: { id: string; content: string; order: number }[];
  images: { id: string; url: string; order: number }[];
  createdAt: string;
}

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "쉬움",
  normal: "보통",
  hard: "어려움",
};

export default function RecipeDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [currentUser, setCurrentUser] = useState<{ id: string } | null>(null);
  const [modal, setModal] = useState<"edit" | "delete" | null>(null);
  const [imageIndex, setImageIndex] = useState(0);

  useEffect(() => {
    fetch(`/api/recipes/${id}`)
      .then((r) => r.json())
      .then(setRecipe);

    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => setCurrentUser(data.user));
  }, [id]);

  if (!recipe) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-10">
        <div className="text-stone-400 text-sm">불러오는 중...</div>
      </main>
    );
  }

  const isOwner = currentUser?.id === recipe.user.id;

  async function handleDelete() {
    const res = await fetch(`/api/recipes/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      {/* Images */}
      {recipe.images.length > 0 && (
        <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-stone-100 mb-8">
          <Image
            src={recipe.images[imageIndex].url}
            alt={recipe.title}
            fill
            className="object-cover"
          />
          {recipe.images.length > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {recipe.images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setImageIndex(i)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i === imageIndex ? "bg-white" : "bg-white/40"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-stone-900">{recipe.title}</h1>
        <div className="flex items-center gap-3 mt-2 text-sm text-stone-400">
          <span>{recipe.user.nickname}</span>
          <span>{new Date(recipe.createdAt).toLocaleDateString("ko-KR")}</span>
        </div>
        {recipe.description && (
          <p className="mt-4 text-stone-600 text-sm leading-relaxed">
            {recipe.description}
          </p>
        )}
      </div>

      {/* Meta */}
      <div className="flex gap-6 py-4 border-y border-stone-100 mb-8 text-sm">
        <div>
          <span className="text-stone-400">인분</span>
          <p className="font-medium text-stone-800">{recipe.servings}인분</p>
        </div>
        {recipe.cookTime && (
          <div>
            <span className="text-stone-400">조리시간</span>
            <p className="font-medium text-stone-800">{recipe.cookTime}분</p>
          </div>
        )}
        <div>
          <span className="text-stone-400">난이도</span>
          <p className="font-medium text-stone-800">
            {DIFFICULTY_LABELS[recipe.difficulty] || recipe.difficulty}
          </p>
        </div>
      </div>

      {/* Ingredients */}
      <section className="mb-8">
        <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider mb-4">
          재료
        </h2>
        <ul className="space-y-2">
          {recipe.ingredients.map((ing) => (
            <li
              key={ing.id}
              className="flex justify-between py-2 border-b border-stone-50 text-sm"
            >
              <span className="text-stone-700">{ing.name}</span>
              <span className="text-stone-400">
                {ing.amount} {ing.unit}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Steps */}
      <section className="mb-8">
        <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider mb-4">
          조리 순서
        </h2>
        <ol className="space-y-6">
          {recipe.steps.map((step) => (
            <li key={step.id} className="flex gap-4">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-stone-800 text-white text-xs font-medium flex items-center justify-center mt-0.5">
                {step.order}
              </span>
              <p className="text-sm text-stone-700 leading-relaxed pt-1">
                {step.content}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* Owner actions */}
      {isOwner && (
        <div className="flex gap-3 pt-6 border-t border-stone-100">
          <button
            onClick={() => setModal("edit")}
            className="btn-secondary"
          >
            수정
          </button>
          <button
            onClick={() => setModal("delete")}
            className="btn-danger"
          >
            삭제
          </button>
        </div>
      )}

      {/* Password Modal */}
      {modal && (
        <PasswordModal
          action={modal}
          onCancel={() => setModal(null)}
          onConfirm={() => {
            if (modal === "delete") {
              handleDelete();
            } else {
              router.push(`/recipes/${id}/edit`);
            }
          }}
        />
      )}
    </main>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add recipe detail page with password-verified edit/delete"
```

---

## Task 11: Home Page (Recipe List) & RecipeCard

**Files:**
- Create: `src/components/RecipeCard.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Create RecipeCard component**

Create `src/components/RecipeCard.tsx`:

```tsx
import Link from "next/link";
import Image from "next/image";

interface Props {
  id: string;
  title: string;
  nickname: string;
  cookTime: number | null;
  difficulty: string;
  imageUrl: string | null;
  createdAt: string;
}

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "쉬움",
  normal: "보통",
  hard: "어려움",
};

export default function RecipeCard({
  id,
  title,
  nickname,
  cookTime,
  difficulty,
  imageUrl,
  createdAt,
}: Props) {
  return (
    <Link href={`/recipes/${id}`} className="card group block">
      <div className="relative aspect-[4/3] bg-stone-100">
        {imageUrl ? (
          <Image src={imageUrl} alt={title} fill className="object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-stone-300">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-stone-900 text-sm group-hover:text-stone-600 transition-colors line-clamp-1">
          {title}
        </h3>
        <div className="flex items-center gap-2 mt-2 text-xs text-stone-400">
          <span>{nickname}</span>
          <span>·</span>
          {cookTime && <><span>{cookTime}분</span><span>·</span></>}
          <span>{DIFFICULTY_LABELS[difficulty] || difficulty}</span>
        </div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Update home page with recipe list**

Replace `src/app/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import RecipeCard from "@/components/RecipeCard";

interface Recipe {
  id: string;
  title: string;
  cookTime: number | null;
  difficulty: string;
  user: { nickname: string };
  images: { url: string }[];
  createdAt: string;
}

export default function Home() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/recipes")
      .then((r) => r.json())
      .then((data) => {
        setRecipes(data);
        setLoading(false);
      });
  }, []);

  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      <div className="mb-10">
        <h1 className="text-2xl font-bold text-stone-900 tracking-tight">
          레시피
        </h1>
        <p className="mt-1 text-sm text-stone-400">
          모든 레시피를 둘러보세요
        </p>
      </div>

      {loading ? (
        <div className="text-sm text-stone-400">불러오는 중...</div>
      ) : recipes.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-stone-400 text-sm">
            아직 등록된 레시피가 없습니다.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {recipes.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              id={recipe.id}
              title={recipe.title}
              nickname={recipe.user.nickname}
              cookTime={recipe.cookTime}
              difficulty={recipe.difficulty}
              imageUrl={recipe.images[0]?.url || null}
              createdAt={recipe.createdAt}
            />
          ))}
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add home page with recipe card grid"
```

---

## Task 12: My Recipes Page

**Files:**
- Create: `src/app/my-recipes/page.tsx`

- [ ] **Step 1: Create my-recipes page**

Create `src/app/my-recipes/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import RecipeCard from "@/components/RecipeCard";

interface Recipe {
  id: string;
  title: string;
  cookTime: number | null;
  difficulty: string;
  user: { nickname: string };
  images: { url: string }[];
  createdAt: string;
}

export default function MyRecipesPage() {
  const router = useRouter();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const meRes = await fetch("/api/auth/me");
      const me = await meRes.json();

      if (!me.user) {
        router.push("/login");
        return;
      }

      const res = await fetch(`/api/recipes?userId=${me.user.id}`);
      const data = await res.json();
      setRecipes(data);
      setLoading(false);
    }
    load();
  }, [router]);

  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      <div className="mb-10">
        <h1 className="text-2xl font-bold text-stone-900 tracking-tight">
          내 레시피
        </h1>
        <p className="mt-1 text-sm text-stone-400">
          내가 등록한 레시피 목록
        </p>
      </div>

      {loading ? (
        <div className="text-sm text-stone-400">불러오는 중...</div>
      ) : recipes.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-stone-400 text-sm mb-4">
            아직 등록한 레시피가 없습니다.
          </p>
          <button
            onClick={() => router.push("/recipes/new")}
            className="btn-primary"
          >
            첫 레시피 작성하기
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {recipes.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              id={recipe.id}
              title={recipe.title}
              nickname={recipe.user.nickname}
              cookTime={recipe.cookTime}
              difficulty={recipe.difficulty}
              imageUrl={recipe.images[0]?.url || null}
              createdAt={recipe.createdAt}
            />
          ))}
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: add my-recipes page"
```

---

## Task 13: Next.js Image Configuration & Final Polish

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: Allow local images in Next.js Image component**

Update `next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
```

- [ ] **Step 2: Full integration test**

```bash
cd /Users/manager/imchef && npm run dev
```

Test the following flow manually:
1. Visit http://localhost:3000 — empty recipe list shown
2. Click "로그인" → navigate to /signup → create account
3. After signup, redirected to home, header shows nickname
4. Click "새 레시피" → fill in recipe form with title, ingredients, steps, optional images
5. Submit → redirected to recipe detail page
6. Verify recipe detail shows all data correctly (images, ingredients, steps)
7. Click "수정" → password modal appears → enter password → navigated to edit page
8. Modify recipe → save → verify changes
9. Click "삭제" → password modal → confirm → recipe deleted
10. Click "내 레시피" → shows only user's recipes
11. Log out → verify header changes, protected pages redirect to login

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "chore: finalize configuration and polish"
```
