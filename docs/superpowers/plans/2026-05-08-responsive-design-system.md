# Responsive Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make imchef fully responsive for mobile devices by updating the design system and all components/pages.

**Architecture:** Mobile-first responsive approach using Tailwind CSS 4 breakpoints (`sm:640px`, `md:768px`, `lg:1024px`). Changes fall into three layers: (1) design system tokens in globals.css, (2) component-level responsive classes, (3) page-level layout adjustments. The Header gets a hamburger menu for mobile.

**Tech Stack:** Tailwind CSS 4, Next.js 16, React 19, TypeScript

---

### Task 1: Design System - Responsive Base Tokens & Component Classes

**Files:**
- Modify: `src/app/globals.css:21-53`

- [ ] **Step 1: Add viewport meta check**

Next.js automatically injects the viewport meta tag, so no changes needed in `layout.tsx`. Verify by running:

```bash
cd /Users/manager/imchef && npx next build 2>&1 | head -5
```

No code changes needed - this is a verification step.

- [ ] **Step 2: Update button component classes for mobile touch targets**

In `src/app/globals.css`, update the `.btn-primary`, `.btn-secondary`, and `.btn-danger` classes to have larger touch targets on mobile (min 44px height per Apple HIG) and scale down on desktop:

```css
@layer components {
  .btn-primary {
    @apply bg-stone-800 text-stone-50 px-5 py-3 rounded-lg text-sm font-medium
           hover:bg-stone-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed
           sm:py-2.5;
  }

  .btn-secondary {
    @apply bg-stone-200 text-stone-700 px-5 py-3 rounded-lg text-sm font-medium
           hover:bg-stone-300 transition-colors
           sm:py-2.5;
  }

  .btn-danger {
    @apply bg-red-50 text-red-600 px-5 py-3 rounded-lg text-sm font-medium
           hover:bg-red-100 transition-colors
           sm:py-2.5;
  }

  .input-field {
    @apply w-full px-4 py-3 bg-white border border-stone-200 rounded-lg text-base
           placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-300
           focus:border-transparent transition-all
           sm:py-2.5 sm:text-sm;
  }

  .card {
    @apply bg-white rounded-2xl border border-stone-100 overflow-hidden
           hover:shadow-md transition-shadow duration-300;
  }
}
```

Key changes:
- Buttons: `py-3` on mobile (taller touch targets), `sm:py-2.5` on desktop
- Input: `py-3 text-base` on mobile (prevents iOS zoom on focus), `sm:py-2.5 sm:text-sm` on desktop

- [ ] **Step 3: Run the dev server and verify changes compile**

```bash
cd /Users/manager/imchef && npm run dev &
```

Open browser, check that buttons and inputs render correctly at both mobile and desktop widths.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: update design system with responsive touch targets for mobile"
```

---

### Task 2: Header - Mobile Hamburger Menu

**Files:**
- Modify: `src/components/Header.tsx`

- [ ] **Step 1: Add mobile menu state and hamburger button**

Replace the entire Header component with a responsive version that shows a hamburger icon on mobile and inline nav on `sm:` and up:

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
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => setUser(data.user));
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setMenuOpen(false);
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-50 bg-stone-50/80 backdrop-blur-md border-b border-stone-100">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link
          href="/"
          className="text-lg font-bold text-stone-900 tracking-tight"
          onClick={() => setMenuOpen(false)}
        >
          imchef
        </Link>

        {/* Desktop nav */}
        <nav className="hidden sm:flex items-center gap-3">
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

        {/* Mobile hamburger button */}
        <button
          className="sm:hidden p-2 -mr-2 text-stone-600"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="메뉴"
        >
          {menuOpen ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div className="sm:hidden border-t border-stone-100 bg-stone-50/95 backdrop-blur-md">
          <div className="max-w-5xl mx-auto px-4 py-3 space-y-1">
            {user ? (
              <>
                <Link
                  href="/recipes/new"
                  onClick={() => setMenuOpen(false)}
                  className="block px-3 py-2.5 text-sm text-stone-600 hover:bg-stone-100 rounded-lg"
                >
                  새 레시피
                </Link>
                <Link
                  href="/my-recipes"
                  onClick={() => setMenuOpen(false)}
                  className="block px-3 py-2.5 text-sm text-stone-600 hover:bg-stone-100 rounded-lg"
                >
                  내 레시피
                </Link>
                <div className="border-t border-stone-100 mt-1 pt-1">
                  <div className="flex items-center justify-between px-3 py-2.5">
                    <span className="text-sm text-stone-400">{user.nickname}</span>
                    <button
                      onClick={handleLogout}
                      className="text-sm text-stone-400 hover:text-stone-600 transition-colors"
                    >
                      로그아웃
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <Link
                href="/login"
                onClick={() => setMenuOpen(false)}
                className="block px-3 py-2.5 text-sm text-stone-600 hover:bg-stone-100 rounded-lg"
              >
                로그인
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
```

- [ ] **Step 2: Test in browser at mobile width**

Open the dev server. Resize to 375px width (iPhone SE). Verify:
- Hamburger icon appears
- Tapping toggles the dropdown menu
- Links navigate correctly and close menu
- At 640px+ width, inline nav appears and hamburger hides

- [ ] **Step 3: Commit**

```bash
git add src/components/Header.tsx
git commit -m "feat: add responsive hamburger menu for mobile header"
```

---

### Task 3: RecipeForm - Responsive Grid & Spacing

**Files:**
- Modify: `src/components/RecipeForm.tsx:143`

- [ ] **Step 1: Update the servings/cookTime/difficulty grid to be responsive**

Change line 143 from:
```tsx
<div className="grid grid-cols-3 gap-4">
```
to:
```tsx
<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
```

This stacks the three fields vertically on mobile and shows them in a row on `sm:` and up.

- [ ] **Step 2: Update the form action buttons for mobile**

Change the bottom button row (line 215) from:
```tsx
<div className="flex justify-end gap-3 pt-4">
```
to:
```tsx
<div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4">
```

This makes buttons stack full-width on mobile (with submit on top) and inline on desktop.

- [ ] **Step 3: Test in browser**

Open `/recipes/new` at 375px width. Verify:
- Servings, cook time, difficulty stack vertically
- Buttons are full-width and easy to tap
- At 640px+ they revert to inline row layout

- [ ] **Step 4: Commit**

```bash
git add src/components/RecipeForm.tsx
git commit -m "feat: make recipe form responsive with stacked layout on mobile"
```

---

### Task 4: IngredientInput - Responsive Row Layout

**Files:**
- Modify: `src/components/IngredientInput.tsx:42`

- [ ] **Step 1: Update ingredient row to wrap on mobile**

Change the ingredient row (line 42) from:
```tsx
<div key={i} className="flex gap-2 items-start">
```
to:
```tsx
<div key={i} className="flex flex-wrap sm:flex-nowrap gap-2 items-start">
```

Also update the name input (line 43-49) to take full width on mobile:
```tsx
<input
  type="text"
  value={ing.name}
  onChange={(e) => update(i, "name", e.target.value)}
  placeholder="재료명"
  className="input-field w-full sm:w-auto sm:flex-[2]"
/>
```

Update amount and unit fields to share the second row on mobile:
```tsx
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
```

The delete button stays inline - it will naturally appear at the end of the last row.

- [ ] **Step 2: Test in browser**

Open `/recipes/new` at 375px width. Verify:
- Ingredient name takes full row
- Amount + unit share the next row
- Delete button is accessible
- At 640px+ all fields are on one row

- [ ] **Step 3: Commit**

```bash
git add src/components/IngredientInput.tsx
git commit -m "feat: make ingredient input wrap on mobile screens"
```

---

### Task 5: ImageUploader - Responsive Thumbnail Sizes

**Files:**
- Modify: `src/components/ImageUploader.tsx:44,60`

- [ ] **Step 1: Update thumbnail sizes for mobile**

Change the image thumbnail container (line 44) from:
```tsx
<div key={i} className="relative w-28 h-28 rounded-xl overflow-hidden bg-stone-100 group">
```
to:
```tsx
<div key={i} className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden bg-stone-100 group">
```

Change the upload button (line 59-62) from:
```tsx
<label
  className="w-28 h-28 rounded-xl border-2 border-dashed border-stone-200
             flex flex-col items-center justify-center cursor-pointer
             hover:border-stone-400 transition-colors text-stone-400"
>
```
to:
```tsx
<label
  className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl border-2 border-dashed border-stone-200
             flex flex-col items-center justify-center cursor-pointer
             hover:border-stone-400 transition-colors text-stone-400"
>
```

Also make the delete button always visible on mobile (no hover on touch devices). Change line 49:
```tsx
className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/50 rounded-full text-white
           flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
```

- [ ] **Step 2: Test in browser**

Open `/recipes/new` at 375px. Verify:
- Thumbnails are 96px on mobile, 112px on desktop
- Delete button is always visible on mobile (no hover required)
- Upload placeholder matches thumbnail size

- [ ] **Step 3: Commit**

```bash
git add src/components/ImageUploader.tsx
git commit -m "feat: responsive image thumbnails with touch-friendly delete button"
```

---

### Task 6: RecipeCard - Mobile-Optimized Spacing

**Files:**
- Modify: `src/components/RecipeCard.tsx:42`

- [ ] **Step 1: Reduce card padding on mobile**

Change line 42 from:
```tsx
<div className="p-4">
```
to:
```tsx
<div className="p-3 sm:p-4">
```

- [ ] **Step 2: Test in browser**

Open `/` at 375px. Verify cards look compact with less padding, expand at `sm:`.

- [ ] **Step 3: Commit**

```bash
git add src/components/RecipeCard.tsx
git commit -m "feat: reduce recipe card padding on mobile"
```

---

### Task 7: Home & My Recipes Pages - Mobile Spacing

**Files:**
- Modify: `src/app/page.tsx:30-38`
- Modify: `src/app/my-recipes/page.tsx:41-49`

- [ ] **Step 1: Update home page spacing for mobile**

In `src/app/page.tsx`, change the main container and header:

Line 30 from:
```tsx
<main className="max-w-5xl mx-auto px-4 py-10">
```
to:
```tsx
<main className="max-w-5xl mx-auto px-4 py-6 sm:py-10">
```

Line 31 from:
```tsx
<div className="mb-10">
```
to:
```tsx
<div className="mb-6 sm:mb-10">
```

Line 33 from:
```tsx
<h1 className="text-2xl font-bold text-stone-900 tracking-tight">
```
to:
```tsx
<h1 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
```

- [ ] **Step 2: Apply same changes to my-recipes page**

In `src/app/my-recipes/page.tsx`, apply the same pattern:

Line 41 from:
```tsx
<main className="max-w-5xl mx-auto px-4 py-10">
```
to:
```tsx
<main className="max-w-5xl mx-auto px-4 py-6 sm:py-10">
```

Line 42 from:
```tsx
<div className="mb-10">
```
to:
```tsx
<div className="mb-6 sm:mb-10">
```

Line 43 from:
```tsx
<h1 className="text-2xl font-bold text-stone-900 tracking-tight">
```
to:
```tsx
<h1 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
```

- [ ] **Step 3: Test in browser**

Open `/` and `/my-recipes` at 375px. Verify:
- Reduced top/bottom padding
- Smaller heading text
- Grid still shows 2 columns on mobile

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx src/app/my-recipes/page.tsx
git commit -m "feat: responsive spacing and font sizes for home and my-recipes pages"
```

---

### Task 8: Recipe Detail Page - Mobile Spacing

**Files:**
- Modify: `src/app/recipes/[id]/page.tsx`

- [ ] **Step 1: Update container and section spacing**

Line 65 from:
```tsx
<main className="max-w-2xl mx-auto px-4 py-10">
```
to:
```tsx
<main className="max-w-2xl mx-auto px-4 py-6 sm:py-10">
```

Line 48 (loading state) from:
```tsx
<main className="max-w-2xl mx-auto px-4 py-10">
```
to:
```tsx
<main className="max-w-2xl mx-auto px-4 py-6 sm:py-10">
```

- [ ] **Step 2: Update heading and image spacing**

Line 68, change the image container margin from:
```tsx
<div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-stone-100 mb-8">
```
to:
```tsx
<div className="relative w-full aspect-[4/3] rounded-xl sm:rounded-2xl overflow-hidden bg-stone-100 mb-6 sm:mb-8">
```

Line 92-93, change heading margin and size:
```tsx
<div className="mb-6 sm:mb-8">
  <h1 className="text-xl sm:text-2xl font-bold text-stone-900">{recipe.title}</h1>
```

- [ ] **Step 3: Update meta section and section margins**

Line 106, the meta flex section - make it wrap on mobile:
```tsx
<div className="flex flex-wrap gap-4 sm:gap-6 py-4 border-y border-stone-100 mb-6 sm:mb-8 text-sm">
```

Lines 126, 146 - section margins:
```tsx
<section className="mb-6 sm:mb-8">
```
(Apply to both Ingredients and Steps sections.)

- [ ] **Step 4: Update owner action buttons for mobile**

Line 166-167, make buttons full-width on mobile:
```tsx
<div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-stone-100">
```

- [ ] **Step 5: Test in browser**

Open a recipe detail page at 375px. Verify:
- Tighter spacing on mobile
- Smaller heading text
- Meta info wraps cleanly
- Action buttons stack vertically
- Image has smaller border radius

- [ ] **Step 6: Commit**

```bash
git add src/app/recipes/[id]/page.tsx
git commit -m "feat: responsive recipe detail page with mobile spacing"
```

---

### Task 9: Auth Pages - Minor Mobile Polish

**Files:**
- Modify: `src/app/login/page.tsx:37`

- [ ] **Step 1: The login page is already responsive**

The login page uses `max-w-sm` with `px-4` and centered layout - this already works well on mobile. No changes needed.

Verify by opening `/login` at 375px.

- [ ] **Step 2: Commit (skip if no changes)**

No commit needed - auth pages are already responsive.

---

### Task 10: Full Mobile QA Pass

- [ ] **Step 1: Test all pages at iPhone SE width (375px)**

Open Chrome DevTools, select iPhone SE device mode. Visit each page:
- `/` - Home: 2-col grid, compact cards, smaller heading
- `/login` - Login: centered form, easy to tap
- `/signup` - Signup: centered form
- `/recipes/new` - New recipe: stacked form fields, full-width buttons
- `/recipes/[id]` - Detail: tighter spacing, stacked action buttons
- `/my-recipes` - My recipes: same as home

- [ ] **Step 2: Test at iPhone 14 Pro width (393px)**

Same pages, verify layout.

- [ ] **Step 3: Test at iPad Mini width (768px)**

Verify the `md:` breakpoint works: 3-col grids, inline form fields.

- [ ] **Step 4: Test at desktop width (1280px)**

Verify desktop layout is unchanged from before.

- [ ] **Step 5: Test hamburger menu interactions**

- Open menu, navigate, menu should close
- Open menu, click logo, menu should close
- Resize from mobile to desktop, verify inline nav appears

- [ ] **Step 6: Test recipe form on mobile**

- Create a recipe with all fields filled
- Add/remove ingredients
- Add/remove steps
- Upload images
- Submit the form
