# Next.js 16 — Build Cheat-Sheet

_Auto-generated from bundled `node_modules/next/dist/docs` by a parallel digest workflow._
_This is Next.js 16 (App Router) with breaking changes vs older versions. Consult before writing route/page/server code._

## TL;DR breaking changes that bite
- `params`, `searchParams`, `cookies()`, `headers()`, `draftMode()` are **async** — `await` them.
- `fetch` and GET route handlers are **no longer cached by default** — opt in explicitly.
- Tailwind **v4**: `@import "tailwindcss";` + `@theme` (no tailwind.config.js, no autoprefixer).
- Typed route helpers `PageProps<'/route'>` / `LayoutProps<'/route'>` are global (generated).


## fonts

Covers font optimization in Next.js 16 App Router via the `next/font` module, which self-hosts fonts (Google + local) at build time with zero runtime network requests to Google and no layout shift. The font page itself is unchanged in spirit from recent Next, but the surrounding v16 breaking changes (async dynamic APIs, caching defaults) matter for any layout/page that also uses fonts. Key pattern: call the font loader at module scope, apply the returned `.className` to an element.

**Key APIs**

- **next/font/google named imports** — `import { Geist, Roboto } from 'next/font/google'; const f = Geist({ subsets: ['latin'] })`
  - Import the SPECIFIC font by name (e.g. Geist, Roboto) — not a generic default. Call at module/top level, never inside the component render. Returns an object with `.className`, `.style`, and `.variable`. `subsets` is effectively required for performance. Geist is the example font used in current docs (replaces the old Inter-everywhere examples).
- **weight (variable vs static)** — `Roboto({ weight: '400', subsets: ['latin'] })`
  - Variable fonts (recommended) need no `weight`. Non-variable fonts REQUIRE an explicit `weight` string or build fails.
- **next/font/local (localFont)** — `import localFont from 'next/font/local'; const f = localFont({ src: './my-font.woff2' })`
  - Default import (the only default export among the font modules). `src` path is resolved RELATIVE TO THE FILE where localFont is called — fonts can live anywhere (public/ or co-located, e.g. app/fonts/). `src` may be an array of { path, weight, style } objects for multi-file families.
- **applying the font** — `<html lang="en" className={geist.className}>`
  - Apply `.className` to the target element. Fonts are scoped to the component they're used in; put it on the Root Layout's <html>/<body> to apply app-wide. Use `.variable` instead if exposing as a CSS variable for Tailwind/CSS.

**Gotchas**

- The font module is mostly stable, but you're in Next.js 16 (per AGENTS.md: breaking changes vs older versions). Don't carry over assumptions from the rest of the API.
- Next.js 16 dynamic APIs are async: `params`, `searchParams`, `cookies()`, `headers()`, `draftMode()` must be awaited. This doesn't appear on the fonts page but bites any layout/page where you also wire up fonts. Don't write `const { id } = params` — write `const { id } = await params`.
- Caching defaults flipped in recent Next: fetches and GET Route Handlers are no longer cached by default; opt in explicitly (`fetch(url, { cache: 'force-cache' })`, `cacheLife`/`cacheTag`, or route segment config). Not font-specific but a common v16 footgun.
- Call the font loader at module scope only. Calling it inside a component body is unsupported and breaks the build-time optimization.
- localFont `src` is resolved relative to the calling file, NOT the project root — moving the import to another file changes path resolution.
- Self-hosting means no `<link>` to fonts.googleapis.com is emitted; don't also manually add Google Fonts <link> tags (defeats the privacy/perf win and double-loads).
- Non-variable Google fonts without `weight` will error — always pass `weight` for static fonts.
- Old `@next/font` package is gone; it's built into core as `next/font`.

```tsx
import { Geist } from 'next/font/google'

const geist = Geist({
  subsets: ['latin'],
})

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={geist.className}>
      <body>{children}</body>
    </html>
  )
}
```

---

## css-tailwind

Covers styling in the Next.js 16 App Router: Tailwind CSS (v4 setup), CSS Modules, Global CSS, external stylesheets, and how Next.js orders/merges/chunks CSS in dev vs production. Source: node_modules/next/dist/docs/01-app/01-getting-started/11-css.md. This page is purely about CSS integration — it does NOT cover async request APIs (params/searchParams/cookies/headers) or fetch-cache defaults, so none are documented here.

**Key APIs**

- **Tailwind CSS v4 install** — `npm install -D tailwindcss @tailwindcss/postcss`
  - v4 is the default. Two packages only: tailwindcss + @tailwindcss/postcss. No tailwind.config.js and no `npx tailwindcss init` step in this flow; configuration is CSS-first.
- **PostCSS plugin config** — `// postcss.config.mjs export default { plugins: { '@tailwindcss/postcss': {} } }`
  - Tailwind is wired in as a single PostCSS plugin. Replaces the old v3 `tailwindcss`+`autoprefixer` plugin pair.
- **Tailwind CSS import directive** — `/* app/globals.css */ @import 'tailwindcss';`
  - Single `@import 'tailwindcss';` replaces the v3 trio `@tailwind base; @tailwind components; @tailwind utilities;`.
- **CSS Modules** — `import styles from './x.module.css'  // file must end .module.css`
  - Locally-scoped, unique generated class names. Importable anywhere in app/. Recommended for scoped CSS when Tailwind utilities aren't enough.
- **Global CSS import** — `import './global.css'  // in app/layout.tsx (root layout)`
  - Global CSS can be imported into any layout/page/component in app/, but reserve it for truly-global styles (e.g. Tailwind base). Note doc filename inconsistency: Tailwind section uses globals.css, Global-CSS section uses global.css — pick one.
- **External stylesheet import** — `import 'bootstrap/dist/css/bootstrap.css'`
  - Import package CSS anywhere in app/, including colocated components (since 9.5.4). With React 19 you may instead render <link rel="stylesheet" href="..." /> directly.
- **cssChunking config** — `// next.config.js: { experimental?: { cssChunking: 'loose' | 'strict' | boolean } }`
  - Controls how CSS is chunked/merged in production. Use to tune ordering behavior. See config/next-config-js/cssChunking.

**Gotchas**

- Tailwind v4 is the default: drop tailwind.config.js, autoprefixer, and the three @tailwind directives. Use @import 'tailwindcss'; + @tailwindcss/postcss. For old-browser support fall back to the Tailwind v3 guide (app/guides/tailwind-v3-css).
- CSS ordering follows IMPORT ORDER in your code, not file names. A child component's CSS imported before a sibling's stylesheet wins ordering. Disable import-sorting linters/formatters (e.g. ESLint sort-imports) or they will silently reorder CSS.
- Dev vs prod CSS order can differ. Always verify final cascade with `next build`, not just `next dev`.
- Global stylesheets are NOT removed on client navigation. Because Next relies on React's Suspense-integrated stylesheet support, route-to-route navigation keeps prior global sheets mounted, which can cause cross-route style conflicts. Prefer Tailwind + CSS Modules for component styling; keep global CSS minimal.
- Production builds auto-concatenate/chunk CSS into many minified, code-split .css files (not one bundle). Per-route CSS is loaded minimally.
- CSS loads even with JS disabled in production; in dev JS is required (for Fast Refresh).
- Doc uses inconsistent global-CSS filenames (globals.css vs global.css) — these are conventions, not magic names; just stay consistent and import the actual path.

```tsx
// app/layout.tsx — Next.js 16 App Router root layout with Tailwind v4 global CSS
import './globals.css' // contains: @import 'tailwindcss';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

// postcss.config.mjs
// export default { plugins: { '@tailwindcss/postcss': {} } }

// app/globals.css
// @import 'tailwindcss';
```

---

## layouts-pages

Covers the App Router layouts/pages model in Next.js 16.2.x: file-system routing (page/layout/dynamic segments), the now-mandatory async params/searchParams, the new typed PageProps/LayoutProps helpers, Link navigation, and the v16 caching shift to Cache Components (`use cache`) which removes the old route-segment-config caching exports. Source: node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md plus the file-conventions/page.md and route-segment-config docs.

**Key APIs**

- **page.tsx default export** — `export default async function Page(props: PageProps<'/blog/[slug]'>)`
  - Default-export a component per route. params and searchParams are now Promises — must await (or React use()). Reading searchParams forces dynamic rendering.
- **layout.tsx default export** — `export default function Layout(props: LayoutProps<'/dashboard'>)`
  - Takes children (+ named parallel-route slots like props.analytics from @analytics folders). Root layout is required and must render <html> and <body>. Layouts preserve state and do not re-render on navigation.
- **params** — `params: Promise<{ slug: string }>`
  - Async since v15; synchronous access fully removed/deprecated — always `const { slug } = await params`. Static routes resolve to {}.
- **searchParams** — `searchParams: Promise<{ [key: string]: string | string[] | undefined }>`
  - Request-time API, await it. Opts page into dynamic rendering. For client-only reads use useSearchParams; in event handlers use new URLSearchParams(window.location.search).
- **PageProps / LayoutProps** — `PageProps<'/route'> , LayoutProps<'/route'>`
  - Global generated helpers (no import). Infer typed params and named slots from the route string. Generated by next dev / next build / next typegen.
- **generateStaticParams** — `export function generateStaticParams(): Array<Params> | Promise<...>`
  - Pre-renders dynamic segments at build time. dynamicParams (default true) controls whether non-listed params render on demand or 404.
- **Link** — `import Link from 'next/link'; <Link href={`/blog/${slug}`}>`
  - Primary navigation; extends <a> with prefetch + client-side transitions. useRouter for imperative nav.
- **use cache directive** — `'use cache' (function/component top) + cacheLife('hours') / cacheTag(tag) from 'next/cache'`
  - v16 caching model when cacheComponents:true. Args + closed-over values form the cache key. Replaces removed route-segment caching exports.
- **cacheComponents config** — `const nextConfig: NextConfig = { cacheComponents: true }`
  - Opt-in in next.config.ts. Enables use cache, cacheLife, cacheTag, and unstable_instant; changes GET Route Handlers to follow the page prerender model.
- **unstable_instant** — `export const unstable_instant = { prefetch: 'static' }`
  - Route segment export (draft). Validates the route produces an instant static shell. Requires cacheComponents; throws in Client Components.

**Gotchas**

- params and searchParams are Promises in v16 — you MUST await them (or use React `use`). The synchronous access that still half-worked in v15 is gone/deprecated; code copied from v13/14 tutorials will break.
- Caching default changed: there is no implicit fetch/route cache. With Cache Components (cacheComponents:true) you cache explicitly via the `use cache` directive — nothing is cached unless you opt in.
- v16.0.0 REMOVED the route-segment-config exports `dynamic`, `dynamicParams`(when CC on), `revalidate`, and `fetchCache` once Cache Components is enabled. Don't reach for `export const revalidate = 60` / `export const dynamic = 'force-dynamic'` — use `use cache` + cacheLife/cacheTag instead (or the 'Caching without Cache Components' legacy guide if CC is off).
- `export const experimental_ppr = true` was removed in v16 (codemod available). `runtime = 'experimental-edge'` deprecated since 15-RC — use 'edge'.
- Remaining valid route-segment-config exports are only: dynamicParams, runtime ('nodejs'|'edge', default 'nodejs'), preferredRegion, maxDuration (+ draft unstable_instant). Anything else is stale.
- PageProps/LayoutProps are GLOBAL — do not import them. They are codegen'd by next dev/build/typegen, so a fresh checkout may show type errors until you run one of those (run `next typegen`).
- Reading searchParams (or other request-time APIs) opts the whole page into dynamic rendering — keep it out of segments you want statically prerendered / instant.
- Root layout must include <html> and <body>; it is required and cannot be removed.
- Named parallel-route slots (@analytics etc.) surface as typed props on LayoutProps (props.analytics), not as children.

```tsx
// app/blog/[slug]/page.tsx — Next.js 16 (async params + typed PageProps + use cache)
import { cacheLife } from 'next/cache'

async function getPost(slug: string) {
  'use cache'
  cacheLife('hours')
  return db.post.findUnique({ where: { slug } })
}

export default async function Page(props: PageProps<'/blog/[slug]'>) {
  const { slug } = await props.params        // params is a Promise — must await
  const post = await getPost(slug)
  return (
    <article>
      <h1>{post.title}</h1>
      <p>{post.content}</p>
    </article>
  )
}
// Requires `cacheComponents: true` in next.config.ts for `use cache`.
```

---

## metadata

Covers the Next.js 16 App Router Metadata APIs: the static `metadata` object, the async `generateMetadata` function, file-based metadata conventions (favicons, OG/Twitter images, robots, sitemap), and dynamic OG image generation via `ImageResponse` from `next/og`. Key Next 16 shift: `params`/`searchParams` are Promises (must be awaited), data fetching is dynamic-by-default under Cache Components, and metadata streams for dynamic pages. Source: node_modules/next/dist/docs/01-app/01-getting-started/14-metadata-and-og-images.md plus the referenced generate-metadata / image-response / cacheComponents API refs.

**Key APIs**

- **metadata (static object)** — `export const metadata: Metadata = { title, description, openGraph, ... }`
  - Import `type { Metadata } from 'next'`. Export from a STATIC layout.js/page.js only. Server Components only — not supported in Client Components. Cannot coexist with generateMetadata in the same file.
- **generateMetadata** — `export async function generateMetadata({ params, searchParams }: { params: Promise<{...}>, searchParams: Promise<{...}> }, parent: ResolvingMetadata): Promise<Metadata>`
  - For data-dependent metadata. params/searchParams are PROMISES in Next 16 — must `await` them. `searchParams` only available in page.js, not layout.js. Second arg `parent: ResolvingMetadata` is also a promise (`(await parent).openGraph?.images`). Server Components only. For typed args use `PageProps<'/route'>` / `LayoutProps<'/route'>` helpers.
- **ImageResponse** — `new ImageResponse(element: ReactElement, options?: { width, height, fonts, ... })`
  - Import from 'next/og' (NOT next/server — that import path is the old pre-v14 location). Generates PNG from JSX+CSS via satori+resvg. Only flexbox + a subset of CSS; `display:grid` and advanced layouts unsupported. Containers with multiple children need explicit `display:'flex'`. Max bundle size 500KB (JSX+CSS+fonts+images).
- **opengraph-image / twitter-image (file convention)** — `app/**/opengraph-image.(jpg|png|gif) OR opengraph-image.tsx exporting `size`, `contentType`, default async Image()`
  - Static: drop an image file in a route folder. Dynamic: opengraph-image.tsx with `export const size = {width,height}`, `export const contentType`, and a default fn returning ImageResponse. More specific (deeper) image wins over ancestors. The default fn receives `{ params }` (await if needed under Cache Components).
- **favicon / icon / apple-icon (file convention)** — `app/favicon.ico, app/icon.(jpg|png|svg), app/apple-icon.png`
  - favicon.ico goes at the ROOT of the app folder. Can also be generated programmatically (icon.tsx via ImageResponse).
- **generateViewport / viewport** — `export function generateViewport(): Viewport  OR  export const viewport: Viewport`
  - Use this for themeColor, colorScheme, and viewport settings. The metadata-object fields `themeColor`, `colorScheme`, and `viewport` are DEPRECATED (since v14) — do not put them in the Metadata object.
- **React cache()** — `import { cache } from 'react'; export const getX = cache(async (id) => {...})`
  - Memoize a data fn shared between generateMetadata and the page so it runs once per request. Distinct from the `use cache` directive (persistent caching).
- **htmlLimitedBots (next.config)** — `htmlLimitedBots: RegExp`
  - Controls/disables metadata streaming. Streaming metadata is auto-disabled for known crawlers (Twitterbot, Slackbot, Bingbot) detected via User-Agent; widen or disable via this config.

**Gotchas**

- BREAKING (v16): `params` and `searchParams` are Promises everywhere — in generateMetadata AND in the page/layout/Image component. You MUST `await params`. The synchronous `params.slug` usage shown in a couple of the getting-started examples reflects older Next and is outdated; treat the typed `Promise<{...}>` examples (and the API reference) as authoritative.
- BREAKING (v16): `ImageResponse` must be imported from `next/og`. The `next/server` import path was removed (it only worked v13.3–13.x). Importing from next/server will fail.
- Cache Components (cacheComponents: true in next.config.ts) makes data fetching DYNAMIC BY DEFAULT. generateMetadata that touches cookies()/headers()/params/searchParams or does uncached fetches defers to request time; opt into caching with the `use cache` directive + cacheLife/cacheTag.
- v16 removed `experimental.ppr` flag and `experimental_ppr` route segment config — PPR is now the default behavior under cacheComponents. Also `experimental.dynamicIO` and `experimental.useCache` are gone (folded into cacheComponents); migrate per the v16 upgrade guide.
- `metadata` object and `generateMetadata` are Server-Component-only; they silently do nothing / error in Client Components.
- Don't export both `metadata` and `generateMetadata` from the same file — mutually exclusive.
- DEPRECATED metadata fields: `themeColor`, `colorScheme`, `viewport` — moved to the separate `viewport`/`generateViewport` export. Putting them in Metadata is deprecated.
- `searchParams` is unavailable in layout.js generateMetadata — only page.js segments receive it.
- cookies()/headers() are async — `(await cookies()).get(...)`. Accessing them in generateMetadata forces request-time (dynamic) rendering.
- Prerendered (static) pages resolve metadata at build time and don't stream; only dynamically-rendered pages stream metadata, and streaming is skipped for detected bots.
- ImageResponse: avoid grid/unsupported CSS; multi-child containers must set display:'flex' explicitly or rendering breaks; watch the 500KB bundle cap when embedding fonts/images.

```tsx
// app/blog/[slug]/page.tsx  — Next.js 16: params is a Promise, must be awaited
import type { Metadata } from 'next'
import { cache } from 'react'

// Shared, request-memoized fetch (runs once for metadata + page)
const getPost = cache(async (slug: string) => {
  const res = await fetch(`https://api.example.com/blog/${slug}`)
  return res.json()
})

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params            // await the Promise
  const post = await getPost(slug)
  return {
    title: post.title,
    description: post.description,
    openGraph: { images: ['/some-specific-page-image.jpg'] },
  }
}

export default async function Page({ params }: Props) {
  const { slug } = await params            // await here too
  const post = await getPost(slug)
  return <article><h1>{post.title}</h1></article>
}

// app/blog/[slug]/opengraph-image.tsx  — dynamic OG image
// import { ImageResponse } from 'next/og'   // NOT next/server
// export const size = { width: 1200, height: 630 }
// export const contentType = 'image/png'
// export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
//   const { slug } = await params
//   const post = await getPost(slug)
//   return new ImageResponse(
//     <div style={{ display: 'flex', width: '100%', height: '100%',
//       alignItems: 'center', justifyContent: 'center', fontSize: 128, background: '#fff' }}>
//       {post.title}
//     </div>, size)
// }
```

---

## route-handlers

Next.js 16 App Router Route Handlers: custom request handlers defined in `route.ts|js` inside `app/`, built on Web Request/Response. Key shifts vs older Next: GET handlers are uncached by default, route `params` is now a Promise that must be awaited, and `cookies()`/`headers()` are async. New additions include the `RouteContext<'/path'>` type helper and Cache Components behavior (`use cache` + `cacheLife`).

**Key APIs**

- **HTTP method exports** — `export async function GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS(request: Request, context?)`
  - One named export per verb in app/<path>/route.ts. Unsupported methods auto-return 405. Each route.js owns all verbs for that segment.
- **params (dynamic segments)** — `const { id } = await ctx.params`
  - params is now a Promise — MUST await it. Older sync `ctx.params.id` access is gone.
- **RouteContext<'/path'>** — `(req: NextRequest, ctx: RouteContext<'/users/[id]'>) => ...`
  - New globally-available TS helper to type the context param. Types generated during next dev / next build / next typegen.
- **cookies() / headers()** — `const h = await headers(); h.get('user-agent')`
  - Async — import from 'next/headers' and await. Calling them marks the handler request-time (stops prerendering under Cache Components).
- **export const dynamic** — `export const dynamic = 'force-static'`
  - Route segment config. Use 'force-static' to opt a GET into caching (only path to cache a GET when Cache Components is off).
- **NextRequest / NextResponse** — `import type { NextRequest } from 'next/server'`
  - Extended helpers over native Request/Response for advanced cases (cookies, geo, redirects, rewrites).
- **Response.json()** — `return Response.json({ data })`
  - Standard Web API response helper used for JSON returns.
- **use cache + cacheLife** — `'use cache'; cacheLife('hours')`
  - Under Cache Components, wrap a helper fn (NOT the handler body) with `use cache` to include uncached data in a prerendered GET. cacheLife from 'next/cache' controls revalidation.
- **connection()** — `import { connection } from 'next/cache'`
  - Request-time API; like cookies()/headers(), accessing it terminates prerendering.

**Gotchas**

- GET handlers are NOT cached by default (changed from older Next where GET could be cached). Opt in via `export const dynamic = 'force-static'`.
- Only GET can be cached. POST/PUT/PATCH/DELETE/etc. are never cached, even when colocated with a cached GET in the same file.
- `ctx.params` is a Promise — you must `await ctx.params`. Synchronous param access from older Next no longer works.
- `cookies()` and `headers()` from 'next/headers' are async and must be awaited.
- `use cache` CANNOT be placed in the Route Handler body — extract the cached work into a helper function and put the directive there.
- With Cache Components enabled, GET handlers behave like UI routes: prerendered at build unless they touch runtime/uncached data. Prerendering stops on network/db calls, async fs ops, request props (req.url, request.headers/cookies/body), or runtime APIs (cookies/headers/connection), or non-deterministic ops like Math.random().
- You cannot have both route.js and page.js at the same route segment — it's a conflict. (route.js at a nested/api path alongside page.js elsewhere is fine.)
- Route Handlers live only in the app directory; they replace pages/ API Routes — don't mix the two.
- Route Handlers do not participate in layouts or client-side navigation.
- RouteContext types are codegen'd — run next dev/build/typegen or the type won't resolve.

```tsx
// app/users/[id]/route.ts
import type { NextRequest } from 'next/server'

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<'/users/[id]'>
) {
  const { id } = await ctx.params // params is a Promise — await it
  return Response.json({ id })
}
```

---

## mutating-data-server-actions

Covers data mutations in the Next.js 16 App Router via React Server Functions / Server Actions ('use server'): how to define them (separate file, inline in Server Components, or passed as props), how to invoke them (forms, event handlers, useEffect), and the post-mutation primitives for refreshing, revalidating, redirecting, and cookie handling. Key Next 16 changes: the new next/cache refresh() and updateTag() functions, async cookies(), and the action-as-prop naming convention.

**Key APIs**

- **'use server' directive** — `top of an async fn body, or top of a file (marks all exports)`
  - Defines a Server Function. Inline only allowed in Server Components, never in Client Components. Client Components import them from a 'use server' file and use them.
- **refresh** — `import { refresh } from 'next/cache'; refresh()`
  - NEW in Next 16. Refreshes the client router so UI reflects latest state. Imported from next/cache (NOT router.refresh). Does NOT revalidate tagged data — use updateTag/revalidateTag for that.
- **updateTag** — `import { updateTag } from 'next/cache'`
  - NEW. The way to revalidate tagged data when you also need the current render refreshed; cited alongside refresh() as the tag-aware counterpart.
- **revalidatePath** — `import { revalidatePath } from 'next/cache'; revalidatePath('/posts')`
  - Revalidates the Next.js cache for a path after a mutation. Call before redirect() if you need fresh data.
- **revalidateTag** — `import { revalidateTag } from 'next/cache'`
  - Revalidates cache entries by tag. Still present in Next 16 alongside the newer updateTag.
- **redirect** — `import { redirect } from 'next/navigation'; redirect('/posts')`
  - Throws a framework control-flow exception; code after it does not run. Imported from next/navigation (NOT next/cache).
- **cookies** — `const cookieStore = await cookies()  // from 'next/headers'`
  - ASYNC in Next 16 — must be awaited. Then .get('name')?.value, .set('name','val'), .delete('name'). Setting/deleting in a Server Action re-renders the current page+layouts so UI reflects the new value.
- **useActionState** — `const [state, action, pending] = useActionState(fn, initialState)`
  - React hook (from 'react') for pending state. Replaces the old useFormState. Returns a pending boolean as the 3rd element.
- **startTransition / useTransition** — `startTransition(action) / const [isPending, startTransition] = useTransition()`
  - Wrap Server Action calls in event handlers and useEffect. A Server Action is by convention an async fn used with startTransition (automatic when passed to <form action> or <button formAction>).
- **<form action> / <button formAction>** — `<form action={createPost}> / <button formAction={createPost}>`
  - React-extended props that auto-pass FormData and auto-wrap in a transition. POST only — actions are invoked exclusively via HTTP POST.

**Gotchas**

- BREAKING: cookies() is now async — you must `await cookies()` before .get/.set/.delete. Same async pattern applies to the other dynamic APIs (headers, params, searchParams) in Next 16.
- refresh() is a NEW import from 'next/cache', not router.refresh(). It refreshes the client router but does NOT revalidate tagged data — pair with updateTag()/revalidateTag() if tagged caches changed.
- Server Functions are reachable via direct POST requests, not only through your UI. You MUST re-verify auth/authz (and resource ownership for deletes/updates) inside EVERY Server Function — never rely on the caller.
- Actions are POST-only; only HTTP POST can invoke them.
- Server Functions must be async (they run over a network request). 'use server' on a non-async function is invalid.
- You cannot DEFINE a Server Function in a Client Component — only import and invoke one. Inline definitions are Server-Component-only.
- redirect() throws a control-flow exception, so any code after it is skipped; if you need fresh data, call revalidatePath/revalidateTag BEFORE redirect().
- Convention: when passing an action as a prop to a Client Component, name it with an 'Action' suffix (e.g. updateItemAction) so the compiler/lint recognizes it.
- The client dispatches/awaits Server Functions one at a time (serial), so don't use them for parallel data fetching — fetch in Server Components or do parallel work inside one action/Route Handler.
- useActionState (React) replaces the deprecated useFormState; import from 'react', not 'react-dom'.
- In event handlers/useEffect, wrap the action in startTransition so useActionState's pending state works (a bare onClick form-less call won't auto-transition).

```tsx
// app/actions.ts
'use server'

import { auth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

export async function createPost(formData: FormData) {
  // Always re-check auth inside the action (reachable via raw POST)
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const title = formData.get('title')

  // ...mutate data...

  const cookieStore = await cookies() // async in Next 16
  cookieStore.set('lastPost', String(title))

  revalidatePath('/posts') // revalidate before redirect to get fresh data
  redirect('/posts')       // throws; nothing after this runs
}

// app/ui/form.tsx (Server Component — no 'use client' needed)
import { createPost } from '@/app/actions'

export function Form() {
  return (
    <form action={createPost}>
      <input type="text" name="title" />
      <button type="submit">Create</button>
    </form>
  )
}
```

---

## fetching-data

Covers data fetching in the Next.js 16 App Router: async Server Components (fetch + ORM/DB), streaming via loading.js and <Suspense>, Client Component fetching with React's use() API and SWR/React Query, plus sequential/parallel patterns and request-scoped sharing via React.cache + context. The headline Next.js 16 change reflected here: fetch is NOT cached by default, and dynamic route params is a Promise that must be awaited.

**Key APIs**

- **fetch (in Server Components)** — `const res = await fetch(url) // inside `async function Page()``
  - NOT cached by default in Next 16 — blocks render until complete. Opt into caching with the `use cache` directive or stream with <Suspense>. Identical fetches in one render tree are still request-deduped (memoized).
- **params (page/layout prop)** — `params: Promise<{ username: string }>; const { username } = await params`
  - BREAKING: params is now a Promise and MUST be awaited. Same applies to searchParams. Old synchronous `params.username` access is gone.
- **use cache directive** — `'use cache' (directive) / see api-reference/directives/use-cache`
  - The opt-in caching mechanism replacing implicit fetch caching. Pairs with Cache Components, which surface a build-time error when a layout reads uncached/runtime data that would block loading.js.
- **loading.js / loading.tsx** — `export default function Loading() { return <Spinner/> }`
  - Wraps page + children in an automatic <Suspense> boundary. GOTCHA: a layout that reads cookies()/headers()/uncached fetch does NOT fall back to same-segment loading.js — it blocks navigation. Fix: wrap that access in its own <Suspense> or move fetching into page.js.
- **React use() API** — `const data = use(promise)`
  - Read a server-passed promise inside a Client Component (must be under <Suspense>). Don't await the fetching fn in the Server Component — pass the unawaited promise as a prop.
- **React.cache** — `import { cache } from 'react'; export const getUser = cache(async () => {...})`
  - Request-scoped memoization for non-fetch data access (ORM/DB). Scoped to the CURRENT request only — no cross-request sharing. Combine with a context provider to share one promise across Server + Client Components.
- **context value shorthand** — `<UserContext value={userPromise}>{children}</UserContext>`
  - React 19 JSX: render the Context object directly with `value` (no `.Provider`). Used to pass an unawaited promise down for Client Components to resolve via use().
- **Promise.all / Promise.allSettled** — `const [a,b] = await Promise.all([getA(), getB()])`
  - Parallel fetching: initiate fetches (call without await) then await together. allSettled if one failure shouldn't reject the batch. Layouts/pages already render in parallel by segment.

**Gotchas**

- fetch is NO LONGER cached by default — the biggest break from older Next. Uncached fetches block render; use `use cache` or <Suspense> deliberately.
- params and searchParams are now Promises — you MUST `await params` / `await searchParams`. Typed as `Promise<{...}>`. Synchronous access is removed.
- cookies() and headers() are async/runtime APIs; reading them in a layout blocks navigation and defeats same-segment loading.js. Wrap in <Suspense> or push into page.js. Cache Components flags this at build time.
- loading.js only covers what's below it via Suspense; uncached access ABOVE it (in the layout) is not covered — prefer <Suspense> placed close to the runtime/uncached data.
- Multiple await statements in one component run sequentially even though segments render in parallel — initiate with Promise.all to parallelize.
- Promise.all rejects entirely if any request fails; use Promise.allSettled for partial-failure tolerance.
- React.cache memoization does NOT persist across requests — each request gets a fresh scope. Don't treat it as a data cache.
- When streaming a promise to a Client Component, do NOT await it in the Server Component — pass the raw promise and resolve with use() inside a <Suspense> boundary.
- AI-agent hint in the docs: Suspense/streaming alone may not make client-side navigations feel instant — export `unstable_instant` from the route for instant navigations.

```tsx
// app/artist/[username]/page.tsx — Next.js 16
import { Suspense } from 'react'

async function getArtist(username: string) {
  // NOT cached by default in Next 16
  const res = await fetch(`https://api.example.com/artist/${username}`)
  return res.json()
}

export default async function Page({
  params,
}: {
  params: Promise<{ username: string }> // params is a Promise in Next 16
}) {
  const { username } = await params // must await
  const artist = await getArtist(username)

  return (
    <>
      <h1>{artist.name}</h1>
      <Suspense fallback={<div>Loading...</div>}>
        <Playlists artistID={artist.id} />
      </Suspense>
    </>
  )
}

async function Playlists({ artistID }: { artistID: string }) {
  const playlists = await getArtistPlaylists(artistID)
  return (
    <ul>
      {playlists.map((p) => (
        <li key={p.id}>{p.name}</li>
      ))}
    </ul>
  )
}
```

---

## caching

Next.js 16 App Router caching with Cache Components (set `cacheComponents: true` in next.config.ts). The opt-in caching primitive is the `'use cache'` directive (data-level on async functions, UI-level on components/pages/layouts), tuned with `cacheLife`/`cacheTag` from `next/cache` and invalidated with `updateTag`. Partial Prerendering (PPR) is the default render model: cached + deterministic output goes into a static shell, everything else must be `<Suspense>`-wrapped or it errors at build. Runtime APIs (cookies/headers/params/searchParams) are async and only usable inside Suspense or by passing extracted values into cached functions.

**Key APIs**

- **cacheComponents (config)** — `// next.config.ts const nextConfig: NextConfig = { cacheComponents: true }`
  - Master switch in next.config.ts. Enables `use cache` + PPR-by-default. Without it you're on the legacy 'Caching and Revalidating (Previous Model)' path. Also makes GET Route Handlers follow the same prerender model as pages.
- **'use cache' directive** — `async function getUsers() { 'use cache'; ... }`
  - First statement in an async fn body (data-level) or component/page/layout body (UI-level). Put at top of a FILE to cache all exported functions. Args + closed-over parent-scope values auto-join the cache key, so different inputs -> separate entries (enables parameterized/personalized cache). Values must be serializable.
- **cacheLife** — `import { cacheLife } from 'next/cache'; cacheLife('hours')`
  - Called inside a `use cache` scope to set revalidation profile (e.g. 'hours'). From 'next/cache', NOT 'next/headers'.
- **cacheTag** — `import { cacheTag } from 'next/cache'; cacheTag('posts')`
  - Inside `use cache`; tags an entry for targeted invalidation via updateTag/revalidateTag.
- **updateTag** — `import { updateTag } from 'next/cache'; updateTag('posts')`
  - Call in a Server Action ('use server') to immediately expire all entries with that tag; next visitor sees fresh data. Used for mutation->revalidate flow.
- **cookies / headers** — `import { cookies, headers } from 'next/headers' const store = await cookies() store.get('theme')?.value`
  - ASYNC — must be awaited. Runtime API: the reading component must be inside <Suspense> (or extract the value and pass it as a prop into a cached fn). Cannot run in the static shell.
- **params / searchParams** — `// async props on page.tsx const { id } = await params`
  - Runtime APIs treated like cookies/headers — require <Suspense>. Exception: params can prerender if at least one sample is supplied via generateStaticParams.
- **connection** — `import { connection } from 'next/server'; await connection()`
  - Defer to request time before non-deterministic ops (Math.random, Date.now, crypto.randomUUID) OR before synchronous per-request I/O (e.g. node:sqlite). Component must be in <Suspense>.
- **<Suspense>** — `import { Suspense } from 'react'; <Suspense fallback={...}><Dynamic/></Suspense>`
  - Boundary for any component that can't complete during prerender (uncached fetch, runtime APIs, connection()). Fallback goes in the static shell; content streams at request. NOTE: Suspense alone does NOT opt a sync-only component into dynamic rendering.
- **'use cache: remote'** — `'use cache: remote'  // see use-cache-remote`
  - Durable/shared cache variant. Default `use cache` is IN-MEMORY — in serverless it may re-evaluate every request since memory isn't shared; use remote for persistence across requests/instances.

**Gotchas**

- Caching is now OPT-IN, not implicit. Nothing is cached unless you write `'use cache'`. (Inverse of older Next where fetch/routes were cached by default.) Conversely, fresh data needs no opt-out — just don't add the directive and wrap in <Suspense>.
- cookies(), headers(), params, searchParams are ALL async — you must `await` them. Synchronous access is gone.
- PPR is on by default with Cache Components. Any component that can't finish during prerender MUST be either `use cache` or inside <Suspense>, else build/dev throws `Uncached data was accessed outside of <Suspense>` (nextjs.org/docs/messages/blocking-route).
- Non-deterministic ops (Math.random / Date.now / crypto.randomUUID) are rejected unless you either call connection() first (unique per request, needs Suspense) OR put them under `use cache` (same value for all until revalidation). They can't run unguarded.
- Default `use cache` is in-memory and per-instance — unreliable in serverless. Use `'use cache: remote'` for durable shared caching.
- cacheLife/cacheTag/updateTag are imported from 'next/cache'; cookies/headers/connection from 'next/headers' and 'next/server'. Don't mix up the modules.
- Putting `'use cache'` at the top of a FILE silently caches every exported function in it — easy to over-cache.
- An empty-fallback <Suspense> wrapped above <body> in the Root Layout opts the WHOLE app out of the static shell (every request blocks). Scope it with multiple root layouts if you only want it on some routes.
- generateMetadata and generateViewport track runtime-data access separately from the page — handle their dynamic access per the Cache Components metadata/viewport guides.
- Suspense does not by itself force dynamic rendering: a component doing only synchronous work still completes during prerender even when wrapped.

```tsx
// next.config.ts
import type { NextConfig } from 'next'
const nextConfig: NextConfig = { cacheComponents: true }
export default nextConfig

// app/blog/page.tsx
import { Suspense } from 'react'
import { cookies } from 'next/headers'
import { cacheLife, cacheTag, updateTag } from 'next/cache'

export default function BlogPage() {
  return (
    <>
      <BlogPosts />                              {/* cached -> static shell */}
      <Suspense fallback={<p>Loading…</p>}>
        <UserPreferences />                      {/* runtime -> streams */}
      </Suspense>
    </>
  )
}

// Cached: same for everyone, revalidated hourly, tagged for invalidation
async function BlogPosts() {
  'use cache'
  cacheLife('hours')
  cacheTag('posts')
  const posts = await (await fetch('https://api.vercel.app/blog')).json()
  return <ul>{posts.slice(0, 5).map((p: any) => <li key={p.id}>{p.title}</li>)}</ul>
}

// Runtime API is async + must live under <Suspense>
async function UserPreferences() {
  const theme = (await cookies()).get('theme')?.value ?? 'light'
  return <p>Theme: {theme}</p>
}

// Mutation in a Server Action expires the tag immediately
export async function createPost(formData: FormData) {
  'use server'
  await db.post.create({ data: { title: formData.get('title') } })
  updateTag('posts')
}
```

---

## revalidating

Covers data revalidation in Next.js 16's Cache Components model (next.config.ts cacheComponents: true) — the explicit `use cache` + cacheLife/cacheTag approach that replaces the old implicit fetch-caching model. Two strategies: time-based (cacheLife) and on-demand (revalidateTag, the new updateTag, revalidatePath). All caching is now opt-in per-scope via the `use cache` directive; tagging requires it. Note: this specific doc page does NOT cover async params/searchParams/cookies/headers — those are async in Next.js 16 but documented elsewhere.

**Key APIs**

- **use cache** — `'use cache' (directive at top of function/file/component)`
  - Marks a scope as cacheable. ALL caching is now opt-in via this directive — there is no implicit caching. cacheLife and cacheTag only work inside a 'use cache' scope. Imported from behavior, not a function.
- **cacheLife** — `cacheLife(profile: 'seconds'|'minutes'|'hours'|'days'|'weeks'|'max') | cacheLife({ stale, revalidate, expire }) — from 'next/cache'`
  - Time-based revalidation. Profiles map to stale/revalidate/expire seconds (e.g. hours = stale 5m, revalidate 1h, expire 1d). Custom object takes seconds. A cache is 'short-lived' (seconds profile, revalidate:0, or expire<5min) and is auto-excluded from prerenders, becoming a dynamic hole.
- **cacheTag** — `cacheTag(tag: string) — from 'next/cache'`
  - Tags a 'use cache' scope so it can be invalidated on-demand. Reuse a tag across functions to invalidate them together.
- **revalidateTag** — `revalidateTag(tag: string, profile?: 'max'|...) — from 'next/cache'`
  - Stale-while-revalidate invalidation: serves stale immediately, refreshes in background. NOTE the new optional 2nd arg controlling the stale window ('max' = longest); recommended usage revalidateTag('user', 'max'). Callable in Server Actions AND Route Handlers. Good for blogs/catalogs where slight staleness is OK.
- **updateTag** — `updateTag(tag: string) — from 'next/cache'`
  - NEW in Next.js 16. Immediately expires cache (no stale window) for read-your-own-writes — user sees their change instantly. Server Actions ONLY (not Route Handlers). Use after a mutation, typically before redirect().
- **revalidatePath** — `revalidatePath(path: string) — from 'next/cache'`
  - Invalidates all cached data for a route path. Use when you don't know the tags. Docs explicitly recommend preferring tag-based (revalidateTag/updateTag) over path-based — more precise, avoids over-invalidating.

**Gotchas**

- Caching is now OPT-IN. This page assumes Cache Components (cacheComponents: true in next.config.ts). The old implicit fetch()/route caching model is gone here — if cacheComponents is off you're on the 'Previous Model' (guides/caching-without-cache-components), a different API surface. Don't mix mental models.
- updateTag is new and Server-Actions-only. Don't call it in a Route Handler — that's revalidateTag's domain. Pick by intent: updateTag = read-your-own-writes (instant), revalidateTag = background refresh (stale-while-revalidate).
- revalidateTag now takes a SECOND argument (stale-window profile, e.g. 'max'). Older code calling revalidateTag(tag) still works but omits the recommended SWR window control.
- cacheLife/cacheTag are inert outside a 'use cache' scope — adding them without the directive does nothing.
- Short-lived caches (seconds profile / revalidate:0 / expire<5min) are silently dropped from prerenders and become dynamic holes — don't expect them to be statically prerendered.
- Serverless: in-memory cache entries may not persist across revalidations — don't rely on in-memory cache durability across invocations.
- Prefer tags over revalidatePath — path invalidation over-invalidates the whole route.
- Out of scope for this page but a Next.js 16 breaking change to remember: params, searchParams, cookies(), and headers() are async — must be awaited. This doc doesn't cover them; verify against their own API reference pages.

```tsx
// app/lib/data.ts — cache + tag a read
import { cacheLife, cacheTag } from 'next/cache'

export async function getPosts() {
  'use cache'
  cacheLife('hours')
  cacheTag('posts')
  return db.query('SELECT * FROM posts')
}

// app/lib/actions.ts — Server Action: read-your-own-writes
'use server'
import { updateTag } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createPost(formData: FormData) {
  const post = await db.post.create({
    data: { title: formData.get('title') as string },
  })
  updateTag('posts')           // immediate expiry; user sees their write
  redirect(`/posts/${post.id}`)
}

// (Route Handler / background refresh would use:)
// revalidateTag('posts', 'max')  // stale-while-revalidate
```

---

## server-client-components

Covers Next.js 16 App Router Server vs Client Components: defaults, the "use client" boundary, composition patterns (props, interleaving via children/slots, context providers, third-party wrapping), and server/client environment isolation. Layouts and pages are Server Components by default; Client Components are opt-in islands for interactivity/browser APIs. Key Next 16 signal here: dynamic route props like `params` are now async (Promise) and must be awaited.

**Key APIs**

- **"use client" directive** — `'use client' // top of file, above imports`
  - Declares the boundary between server and client module graphs. Once a file has it, ALL its imports and the components it directly renders are bundled to the client — do NOT add it to every leaf component. Does NOT apply to Server Components passed in as children/props (those render on server, passed as rendered output).
- **params (async)** — `{ params }: { params: Promise<{ id: string }> }  →  const { id } = await params`
  - Next 16: params is a Promise. Must await it. Old sync access (params.id directly) is gone for the typed/await path. Same async treatment applies to searchParams. Make the component `async` to await.
- **use() API** — `import { use } from 'react'; const data = use(promise)`
  - React API to stream/unwrap a promise from a Server Component into a Client Component (alternative to awaiting in the server parent then passing props).
- **children slot pattern** — `'use client'\nfunction Modal({ children }: { children: React.ReactNode }) { return <div>{children}</div> }`
  - Interleave server UI inside a Client Component by passing a Server Component as `children` (or any prop). The Server Component renders on the server ahead of time; the Client Component receives rendered output, not the module. This is the canonical way to nest server data fetching inside client interactivity.
- **Context provider via Client wrapper** — `'use client'\nexport const Ctx = createContext({}); function Provider({children}){ return <Ctx.Provider value=...>{children}</Ctx.Provider> }`
  - React context is NOT supported in Server Components. Wrap in a Client Component, then render it in a Server layout. Render providers as deep as possible (wrap {children}, not <html>) to keep static optimization.
- **server-only / client-only** — `import 'server-only'  // or import 'client-only'`
  - Build-time guard: importing a `server-only` module into a Client Component errors at build. Installing the npm packages is OPTIONAL in Next 16 (Next handles them internally for better errors); install only if your lint flags extraneous deps. Next ships its own type decls (needed when tsconfig noUncheckedSideEffectImports is on).
- **NEXT_PUBLIC_ env prefix** — `process.env.NEXT_PUBLIC_FOO (client) vs process.env.FOO (server-only)`
  - Only NEXT_PUBLIC_-prefixed vars reach the client bundle. Unprefixed vars are replaced with an empty string on the client — so server code accidentally run on client silently breaks (e.g. an API key becomes '').

**Gotchas**

- params and searchParams are now Promises in Next 16 — you MUST await them (or use()). Code from older Next that reads params.id synchronously will break. Component must be async to await.
- Props passed Server → Client must be React-serializable. Functions, class instances, Symbols, etc. cannot cross the boundary.
- "use client" is transitive: everything imported into a client module joins the client bundle. To shrink JS, push the directive down to the smallest interactive leaf (e.g. a Search box) rather than marking a whole Layout.
- React context does not work in Server Components — must live inside a 'use client' provider.
- A Server Component passed as `children`/prop to a Client Component still renders on the server; this is allowed and is the intended interleaving pattern. But you cannot IMPORT a Server Component into a Client module and render it there.
- Unprefixed env vars are replaced with '' on the client, so server util functions imported into client code fail silently rather than throwing — use server-only to turn this into a build error.
- Some bundlers strip 'use client' from published libraries; library authors must configure the bundler (e.g. esbuild/tsup) to preserve the directive on client entry points.
- Subsequent client navigations render Client Components entirely on the client (no server HTML) — only the first load uses prerendered HTML; don't rely on server HTML existing post-navigation.

```tsx
// app/[id]/page.tsx — Server Component (default), Next.js 16
import { use } from 'react'
import LikeButton from '@/app/ui/like-button'
import { getPost } from '@/lib/data'

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }> // Next 16: params is async
}) {
  const { id } = await params      // must await
  const post = await getPost(id)   // fetch on server, near the source

  return (
    <main>
      <h1>{post.title}</h1>
      <LikeButton likes={post.likes} /> {/* serializable props only */}
    </main>
  )
}

// app/ui/like-button.tsx — Client Component island
'use client'
import { useState } from 'react'

export default function LikeButton({ likes }: { likes: number }) {
  const [n, setN] = useState(likes)
  return <button onClick={() => setN(n + 1)}>{n} likes</button>
}
```

---

## deploying

Next.js 16.2.7 App Router cheat-sheet. The deploying doc (node_modules/next/dist/docs/01-app/01-getting-started/17-deploying.md) only covers deploy targets (Node server, Docker, static export, and a new Adapter API), but the surrounding getting-started docs confirm the v16 breaking changes a senior dev must heed: async request APIs (params/searchParams/cookies/headers are Promises), fetch is no longer cached by default, the new Cache Components model (`use cache` + PPR) replaces the old implicit Full Route/Data Cache, and config is TypeScript-first (next.config.ts). Covers deploy options plus the request/caching/config API surface.

**Key APIs**

- **package.json scripts** — `"build": "next build", "start": "next start"`
  - Node.js deploy target supports ALL features. `next build` then `next start`. Eject to a custom server only if needed.
- **output: 'standalone' | 'export'** — `next.config.ts → { output: 'standalone' }`
  - 'standalone' = minimal Docker image (only required runtime files). 'export' = fully static HTML/CSS/JS for S3/Nginx/Apache; drops all server-dependent features.
- **Deployment Adapter API (adapterPath)** — `next.config → { adapterPath: '...' }`
  - NEW in v16. Lets platforms customize build/deploy. Verified adapters (run full compat test suite): Vercel, Bun. Cloudflare/Netlify still on their own non-verified integrations.
- **params (page/layout/route)** — `{ params }: { params: Promise<{ slug: string }> } → const { slug } = await params`
  - BREAKING: params is now a Promise; must await (or use() in Client Components). Same for generateMetadata/route handler context.
- **searchParams** — `{ searchParams }: { searchParams: Promise<{ q?: string }> } → await searchParams`
  - BREAKING: now a Promise (page only). It is a runtime/dynamic API — wrap consumers in <Suspense> under Cache Components.
- **cookies / headers** — `import { cookies, headers } from 'next/headers'; const c = await cookies()`
  - BREAKING: async — must await. Runtime-only; components using them must be wrapped in <Suspense> (or pass extracted values into a `use cache` fn as args).
- **fetch()** — `await fetch(url) — NOT cached by default`
  - BREAKING vs v13/14: no implicit Data Cache. Uncached fetch blocks render unless wrapped in <Suspense>. Identical fetches are still request-deduped (memoized) within one render.
- **'use cache' directive** — `async function f(){ 'use cache'; cacheLife('hours'); cacheTag('posts'); ... }`
  - Replaces implicit caching. Put at top of an async fn/component/page (or file = caches all exports). Args + closed-over values form the cache key. Requires cacheComponents: true.
- **cacheLife / cacheTag / updateTag / revalidateTag** — `import { cacheLife, cacheTag, updateTag } from 'next/cache'`
  - cacheLife('hours' | profile) sets TTL; cacheTag tags an entry; updateTag(tag) immediately expires it (use in Server Actions after mutation).
- **cacheComponents config** — `const nextConfig: NextConfig = { cacheComponents: true }`
  - Opt-in flag that turns on the Cache Components model + Partial Prerendering (PPR) as default. Without it, you're on the legacy caching-without-cache-components model.
- **connection()** — `import { connection } from 'next/server'; await connection()`
  - Call before non-deterministic ops (Math.random/Date.now/crypto.randomUUID) or per-request sync DB reads to defer them to request time; wrap in <Suspense>.
- **next upgrade** — `npx next upgrade  (>= 16.1.0)`
  - NEW built-in upgrade command (runs codemods). Pre-16.1 must use `npx @next/codemod@canary upgrade latest`.
- **GET Route Handlers under Cache Components** — `app/.../route.ts export async function GET()`
  - With cacheComponents on, GET handlers follow the same prerender model as pages (statically prerendered unless they touch runtime APIs).

**Gotchas**

- params, searchParams, cookies(), and headers() are ALL Promises in v16 — awaiting is mandatory. Synchronous access (the old v14 pattern) is gone. In Client Components read them with React's use().
- fetch is NOT cached by default anymore. An uncached fetch/DB call blocks the whole route render unless wrapped in <Suspense> or marked 'use cache'. Don't assume the old Data Cache exists.
- With cacheComponents: true, accessing uncached/runtime data outside a <Suspense> or 'use cache' throws a build/dev error: 'Uncached data was accessed outside of <Suspense>' (nextjs.org/docs/messages/blocking-route). This is enforced, not advisory.
- A layout that reads cookies()/headers()/uncached fetch does NOT fall back to a same-segment loading.js — it blocks navigation. Wrap that access in its own <Suspense>, or move fetching into page.js.
- 'use cache' defaults to in-memory storage; in serverless it may re-evaluate every request. Use 'use cache: remote' for durable/shared caching across instances.
- Non-deterministic ops (Math.random, Date.now, crypto.randomUUID) error under Cache Components unless you either call connection() first (per-request, in Suspense) or wrap in 'use cache' (one shared value until revalidation).
- Static export (output: 'export') silently drops server features — no runtime APIs, no Server Actions, no dynamic routes without params. Don't pick it for an app that uses cookies/headers.
- Config is TypeScript-first: next.config.ts with `import type { NextConfig } from 'next'`. generateMetadata/generateViewport track runtime data access separately from the page — handle their dynamic data with the same Suspense rules.
- React.cache() is request-scoped only — no cross-request sharing. Use it for per-request dedupe (e.g. getUser()), not as a persistent cache; use 'use cache' for that.
- Server Components are now async by default for data; pass un-awaited promises to Client Components and resolve with use() to stream rather than await-blocking.

```tsx
// app/blog/[slug]/page.tsx — Next.js 16 (cacheComponents: true)
import { Suspense } from 'react'
import { cookies } from 'next/headers'
import { cacheLife, cacheTag } from 'next/cache'

// Cached UI -> part of the static shell (PPR)
async function Post({ slug }: { slug: string }) {
  'use cache'
  cacheLife('hours')
  cacheTag('posts')
  const res = await fetch(`https://api.example.com/posts/${slug}`)
  const post = await res.json()
  return <article><h1>{post.title}</h1><p>{post.body}</p></article>
}

// Runtime data -> streams at request time, must be in <Suspense>
async function Greeting() {
  const theme = (await cookies()).get('theme')?.value ?? 'light'
  return <p>Theme: {theme}</p>
}

// params is a Promise in v16 -> await it
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  return (
    <>
      <Post slug={slug} />
      <Suspense fallback={<p>Loading…</p>}>
        <Greeting />
      </Suspense>
    </>
  )
}
```

---

## upgrading-breaking

Next.js 16 (App Router) cheat-sheet covering breaking changes vs 15. The big ones: all request APIs (params, searchParams, cookies, headers, draftMode) are now async-only — the sync compat shim from 15 is gone; Turbopack is the default bundler for dev and build; middleware is renamed to proxy (nodejs runtime only); revalidateTag requires a second cacheLife arg; PPR is replaced by cacheComponents; and several next/image defaults tightened for security/cost. Minimum runtime is Node 20.9+, React 19.2, TypeScript 5.1+.

**Key APIs**

- **params / searchParams** — `export default async function Page(props: PageProps<'/blog/[slug]'>) { const { slug } = await props.params; const q = await props.searchParams }`
  - Now Promises. Sync access fully removed in 16 (was a temporary shim in 15). Run `npx next typegen` to get PageProps<>, LayoutProps<>, RouteContext<> helpers. Same for params in layout/page/route/default and metadata image files.
- **cookies / headers / draftMode** — `const cookieStore = await cookies(); const h = await headers(); const dm = await draftMode()`
  - All async-only from next/headers. No synchronous access remains. Codemod: @next/codemod migrate-to-async-dynamic-apis.
- **revalidateTag** — `revalidateTag('posts', 'max')  // from 'next/cache'`
  - BREAKING: now requires a second cacheLife profile arg; single-arg form is deprecated and errors in TS. Stale-while-revalidate semantics (readers see stale while it refreshes).
- **updateTag** — `updateTag('user-123')  // from 'next/cache', Server Actions only`
  - NEW. Read-your-writes: expires AND immediately refreshes within the same request. Use for forms/settings where the user must see their change instantly.
- **refresh** — `refresh()  // from 'next/cache', Server Actions only`
  - NEW. Refreshes the client router from within a Server Action.
- **cacheLife / cacheTag** — `import { cacheLife, cacheTag } from 'next/cache'`
  - Stabilized — drop the unstable_ prefix and the import aliases.
- **proxy (was middleware)** — `// file proxy.ts export function proxy(request: Request) {}`
  - middleware.ts -> proxy.ts; named export middleware -> proxy. Runtime is nodejs only and NOT configurable; edge runtime is unsupported in proxy (keep middleware if you need edge). Config flags renamed e.g. skipMiddlewareUrlNormalize -> skipProxyUrlNormalize.
- **cacheComponents (config)** — `const nextConfig = { cacheComponents: true }`
  - Replaces experimental PPR + experimental.dynamicIO + experimental.useCache. This is how you opt into Partial Prerendering now. Behaves differently from 15-canary PPR; see Migrating to Cache Components.
- **turbopack (config)** — `const nextConfig = { turbopack: { /* opts */ } }`
  - Promoted from experimental.turbopack to top-level. Turbopack is the DEFAULT for next dev and next build.
- **connection()** — `await connection()  // from 'next/server', before reading process.env`
  - Call before reading runtime env vars to ensure they're read at request time, not bundled at build. Needed since serverRuntimeConfig/publicRuntimeConfig are removed.
- **default.js (parallel routes)** — `export default function Default() { notFound() } // or return null`
  - BREAKING: every parallel-route slot now REQUIRES an explicit default.js or the build fails.

**Gotchas**

- params/searchParams/cookies/headers/draftMode are async-ONLY now — the synchronous fallback that 15 still allowed is fully removed; any sync `.get()`/destructure without await breaks.
- Turbopack is default for `next dev` AND `next build`. A custom `webpack` config makes `next build` FAIL by design — opt out with `next build --webpack`, or migrate. Note a plugin can inject a webpack config without you writing one.
- Remove `--turbopack`/`--turbo` from package.json scripts — no longer needed.
- middleware -> proxy rename: proxy runs on nodejs runtime only and is NOT configurable; edge is unsupported. If you rely on edge middleware, stay on `middleware` for now.
- revalidateTag('tag') with one arg is deprecated/errors — must pass a cacheLife profile e.g. revalidateTag('tag','max'). For immediate expiration use updateTag in a Server Action.
- PPR: experimental_ppr segment config and experimental.ppr are removed; use cacheComponents instead. If you depend on current 15-canary PPR behavior, do NOT upgrade — it works differently in 16.
- next/image default changes (all breaking): minimumCacheTTL 60s -> 4h (14400); qualities now [75] only (others coerced to nearest); imageSizes no longer includes 16; maximumRedirects unlimited -> 3; local IP optimization blocked unless images.dangerouslyAllowLocalIP; local image src with query string requires images.localPatterns[].search.
- images.domains is deprecated — use images.remotePatterns. next/legacy/image is deprecated — use next/image.
- REMOVED entirely: AMP (next/amp, useAmp, amp config); `next lint` command (use ESLint/Biome directly — next build no longer lints) and the `eslint` config key; serverRuntimeConfig & publicRuntimeConfig & next/config getConfig() (use env vars + connection()); unstable_rootParams; devIndicators.appIsrStatus/buildActivity/buildActivityPosition.
- next dev now outputs to .next/dev (separate from .next for build), enabling concurrent dev+build; a lockfile blocks duplicate instances. Turbopack trace path is .next/dev/trace-turbopack.
- next dev no longer loads next.config twice: process.argv won't contain 'dev' inside the config (build/typegen still do). For dev-only side effects check NODE_ENV==='development' or use phase.
- Scroll: Next no longer overrides global `scroll-behavior: smooth` on navigation. Add data-scroll-behavior="smooth" to <html> to restore old instant-scroll-to-top behavior.
- ESLint plugin defaults to Flat Config now (aligning with ESLint v10). Migrate off legacy .eslintrc.
- metadata image fns (opengraph-image/twitter-image/icon/apple-icon) and sitemap: the Image fn now receives params AND id as Promises (await them); generateImageMetadata still gets sync params; generateSitemaps' id arrives as a Promise in sitemap().
- Runtime floors raised: Node 20.9+ (18 dropped), TypeScript 5.1+, React 19.2; browsers Chrome/Edge/Firefox 111+, Safari 16.4+.
- next build output dropped the `size` / `First Load JS` columns (inaccurate under RSC) — use Lighthouse/analytics instead.
- Use `next upgrade` (built into 16.1.0+) or `npx @next/codemod@canary upgrade latest` for older; codemod handles turbopack config move, next-lint->eslint, middleware->proxy, unstable_ removal, experimental_ppr removal.

```tsx
// app/blog/[slug]/page.tsx  (Next.js 16)
import { cookies } from 'next/headers'

// PageProps<> is generated by `npx next typegen`
export default async function Page(props: PageProps<'/blog/[slug]'>) {
  const { slug } = await props.params          // params is a Promise now
  const { q } = await props.searchParams        // searchParams too
  const session = (await cookies()).get('session')?.value  // cookies() is async

  return (
    <h1>
      {slug} {q} {session}
    </h1>
  )
}

// app/actions.ts
'use server'
import { updateTag } from 'next/cache'

export async function saveProfile(id: string, data: Profile) {
  await db.users.update(id, data)
  updateTag(`user-${id}`) // read-your-writes: expire + refresh this request
}
```

---

## project-structure

Cheat-sheet for Next.js 16 (verified against installed v16.2.7 docs in node_modules). Covers App Router folder/file conventions from project-structure.md plus the v16 breaking changes a v14/v15 dev must know: fully-async request APIs (params/searchParams/cookies/headers/draftMode), the new opt-in Cache Components / `use cache` caching model, Turbopack-by-default, `middleware`->`proxy` rename, new `revalidateTag`/`updateTag` semantics, and removed legacy config. Source files: /Users/polybot/worldcupbetr/node_modules/next/dist/docs/01-app/01-getting-started/02-project-structure.md and 08-caching.md, .../02-guides/upgrading/version-16.md, .../03-api-reference/03-file-conventions/page.md, .../04-functions/cookies.md and headers.md.

**Key APIs**

- **params (page/layout/route/default/metadata files)** — `params: Promise<{ [key: string]: string | string[] }>`
  - Now ALWAYS a Promise — `const { slug } = await params`. Sync access fully removed in v16 (was deprecated-but-allowed in v15). In Client Components use React `use(params)`.
- **searchParams (page.js only)** — `searchParams: Promise<{ [key: string]: string | string[] | undefined }>`
  - Promise; await or `use()`. Plain object, NOT URLSearchParams. Request-time API: reading it opts the page into dynamic rendering.
- **cookies()** — `const cookieStore = await cookies()  // from 'next/headers'`
  - async — must await. .get/.getAll/.has/.set/.delete/.toString. .set/.delete only in Server Actions or Route Handlers (not during Server Component render).
- **headers()** — `const h = await headers()  // from 'next/headers'`
  - async — must await. Returns read-only Web Headers object (.get/.has/.entries...). Read-only: cannot set/delete.
- **draftMode()** — `await draftMode()`
  - Now async like cookies/headers.
- **PageProps / LayoutProps / RouteContext** — `export default async function Page(props: PageProps<'/blog/[slug]'>)`
  - Globally-available typed helpers (no import). Generated by `next dev`/`next build`/`next typegen`. Pass route literal for typed params.
- **use cache directive** — `'use cache'  (first line of async fn/component/file) + cacheLife('hours')`
  - The v16 caching primitive, active only when cacheComponents:true. Caches return value; args + closed-over values form the cache key. File-level applies to all exports.
- **cacheLife / cacheTag** — `import { cacheLife, cacheTag } from 'next/cache'`
  - Now STABLE — drop the `unstable_` prefix and aliased imports.
- **revalidateTag** — `revalidateTag('posts', 'max')`
  - BREAKING: second arg (a cacheLife profile) now REQUIRED; single-arg form is a TS error. Stale-while-revalidate semantics.
- **updateTag** — `updateTag('user-123')  // Server Actions only`
  - New. Read-your-writes: expires AND refreshes within the same request so the user sees their change immediately.
- **refresh** — `import { refresh } from 'next/cache'; refresh()`
  - New. Refreshes the client router from inside a Server Action.
- **cacheComponents config** — `const nextConfig: NextConfig = { cacheComponents: true }`
  - Replaces experimental.dynamicIO and experimental.useCache (both deprecated). Also the new way to opt into PPR — the experimental_ppr segment flag and experimental.ppr are removed.
- **connection()** — `import { connection } from 'next/server'; await connection()`
  - Call before reading process.env at request time to guarantee runtime (not build-time) evaluation — replaces removed serverRuntimeConfig/publicRuntimeConfig.
- **proxy (was middleware)** — `export function proxy(request: Request) {}  // proxy.ts`
  - middleware file + named export deprecated -> rename to proxy. Runtime is nodejs and NOT configurable; edge runtime NOT supported in proxy (stay on middleware if you need edge). Config flags renamed e.g. skipMiddlewareUrlNormalize -> skipProxyUrlNormalize.
- **Parallel route default.js** — `app/@slot/default.tsx -> export default () => null  (or notFound())`
  - BREAKING: every parallel-route slot now REQUIRES an explicit default.js or the build fails.

**Gotchas**

- Sync request APIs are GONE: params, searchParams, cookies(), headers(), draftMode() must all be awaited. v15's sync-compat shim is removed in v16.
- Turbopack is the DEFAULT for both `next dev` and `next build` — drop the `--turbopack`/`--turbo` flags. A custom `webpack` config makes `next build` FAIL; opt out with `next build --webpack`.
- next.config: `turbopack` is now a top-level key (not `experimental.turbopack`).
- `next lint` command removed and `next build` no longer lints; the `eslint` config option is removed. Run ESLint/Biome directly. @next/eslint-plugin-next now defaults to flat config.
- `middleware` -> `proxy` rename; proxy is nodejs-only (no edge), and that runtime is not configurable.
- Caching is opt-in via cacheComponents + `use cache`; without it you're on the 'previous model' (caching-without-cache-components guide). Note v16 PPR works differently than v15-canary PPR — if you rely on canary PPR, stay on that canary.
- revalidateTag now requires a 2nd cacheLife arg; for immediate read-your-writes use updateTag (Server Actions only) instead.
- Removed entirely: AMP (next/amp, config.amp), serverRuntimeConfig/publicRuntimeConfig (use env vars + connection()), unstable_rootParams, next/legacy/image. devIndicators lost appIsrStatus/buildActivity/buildActivityPosition.
- next/image config breaking defaults: minimumCacheTTL 60s -> 4h (14400); qualities now [75] only; imageSizes drops 16; maximumRedirects unlimited -> 3; local IPs blocked unless dangerouslyAllowLocalIP; local image src with query strings needs images.localPatterns.search; images.domains deprecated -> use remotePatterns.
- Image-generating metadata files (opengraph-image/twitter-image/icon/apple-icon) now receive `params` AND `id` as Promises (await both); generateImageMetadata still gets sync params. sitemap's `id` from generateSitemaps is now a Promise too.
- Runtime reqs raised: Node 20.9+ (no Node 18), TypeScript 5.1+, React 19.2 (canary in App Router).
- `next dev` outputs to .next/dev (separate from build) enabling concurrent dev+build; a lockfile blocks duplicate instances. `process.argv` no longer includes 'dev' in next.config — check NODE_ENV instead.
- Next.js no longer overrides CSS `scroll-behavior: smooth` on navigation; add data-scroll-behavior="smooth" to <html> to restore old behavior.
- Folder conventions (from project-structure.md): private folders `_folder` opt out of routing; route groups `(group)` are omitted from the URL; `@slot` = parallel route; `(.)`/`(..)`/`(...)` = intercepting routes; a segment is only public once page.js or route.js exists; multiple root layouts require <html>/<body> in each.

```tsx
// app/shop/[slug]/page.tsx — Next.js 16
import { cookies, headers } from 'next/headers'

export default async function Page(props: PageProps<'/shop/[slug]'>) {
  // params & searchParams are Promises — await them
  const { slug } = await props.params
  const { sort = 'asc' } = await props.searchParams

  // cookies() and headers() are async too
  const theme = (await cookies()).get('theme')?.value
  const ua = (await headers()).get('user-agent')

  return <h1>{slug} — {sort} — {theme} — {ua}</h1>
}
```

---

## error-handling

Cheat-sheet for error handling in Next.js 16 App Router (verified against installed next@16.2.7, docs page 10-error-handling.md). Covers expected errors (return-value modeling via useActionState, notFound) vs uncaught exceptions (error boundaries). The big v16 shifts: error boundary components now receive an `unstable_retry` callback (replaces the old `reset` prop), there's a new component-level `unstable_catchError` HOC from `next/error`, and route params are Promises that must be awaited.

**Key APIs**

- **error.js / error.tsx** — `'use client'; export default function Error({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void })`
  - Segment-level error boundary. MUST be a Client Component. NOTE v16 BREAKING: the recovery prop is now `unstable_retry` (re-fetches + re-renders the segment), NOT the old stable `reset`. `error.digest` still present for correlating server-side logged errors. Catches render-time errors in children; bubbles to nearest parent boundary.
- **global-error.js / global-error.tsx** — `'use client'; export default function GlobalError({ error, unstable_retry }: {...})`
  - Root-app-dir boundary that replaces the root layout/template when active, so it MUST render its own <html> and <body>. Also uses `unstable_retry`. Works even with i18n setups.
- **unstable_catchError (from next/error)** — `import { unstable_catchError as catchError, type ErrorInfo } from 'next/error'; const Boundary = catchError((props, { error, unstable_retry }: ErrorInfo) => JSX)`
  - NEW in v16. HOC for component-level error boundaries that can wrap ANY part of the tree (not tied to the route-segment file convention). Fallback fn signature is (ownProps, ErrorInfo) where ErrorInfo = { error, unstable_retry }. Returned component used as a wrapper: <Boundary title=...>{children}</Boundary>. Client-only ('use client'). Note the `unstable_` prefix — API not yet stable.
- **notFound (from next/navigation)** — `import { notFound } from 'next/navigation'; notFound()`
  - Throws to trigger the nearest not-found.js (404 UI). Call inside a route segment. not-found.js default export is a plain Server Component (no props needed).
- **redirect (from next/navigation)** — `import { redirect } from 'next/navigation'; redirect(path)`
  - For expected-error flows in Server Components/Actions, prefer redirect over rendering an error string.
- **useActionState (from react)** — `const [state, formAction, pending] = useActionState(action, initialState)`
  - React hook (import from 'react', NOT 'react-dom' useFormState which is removed). Returns 3-tuple incl. built-in `pending`. Bind `formAction` to <form action={...}>. Pair with Server Functions that RETURN error objects rather than throwing.
- **Server Function ('use server')** — `'use server'; export async function action(prevState, formData: FormData) { ...; if (!ok) return { message } }`
  - Model EXPECTED errors as return values; do not throw/try-catch for them. The returned object becomes `state` in useActionState.
- **params / searchParams** — `{ params }: { params: Promise<{ slug: string }> } → const { slug } = await params`
  - v16 BREAKING: params and searchParams are Promises and MUST be awaited (or React.use()'d in client comps). The synchronous-access fallback from earlier Next versions is gone.

**Gotchas**

- Error boundary recovery prop renamed: it's `unstable_retry`, not `reset`. Code/snippets using `reset` are pre-v16 and will get an undefined prop. `unstable_retry` re-fetches and re-renders the failed segment.
- `unstable_catchError` and `unstable_retry` carry the `unstable_` prefix — APIs may change; isolate them so a rename is a one-line fix.
- `error.tsx` and `global-error.tsx` MUST start with 'use client' — error boundaries are always Client Components.
- `global-error.tsx` replaces the root layout, so it must render its own <html> and <body> or the page renders blank.
- Error boundaries only catch errors thrown DURING RENDER. They do NOT catch errors in event handlers or in async code that runs after render — catch those manually and surface via useState/useReducer.
- Exception: errors thrown inside startTransition (from useTransition) DO bubble to the nearest error boundary, unlike plain event-handler errors.
- params/searchParams are Promises in v16 — forgetting to await them yields a Promise where you expect a value (TS will also flag it). Type as Promise<{...}>.
- For expected errors (validation, failed fetch) do NOT throw — return a value (useActionState) or render conditionally / redirect. Reserve throwing for genuinely uncaught exceptions.
- useActionState comes from 'react' and provides `pending` directly; the old react-dom useFormState / separate useFormStatus pattern is outdated.
- next/error is a real import path here for unstable_catchError + ErrorInfo type — don't confuse with the legacy Pages-Router next/error 404 component.

```tsx
// app/dashboard/error.tsx — Next.js 16 segment error boundary
'use client' // error boundaries must be Client Components

import { useEffect } from 'react'

export default function ErrorPage({
  error,
  unstable_retry, // v16: replaces the old `reset` prop
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  useEffect(() => {
    console.error(error) // report to your error service
  }, [error])

  return (
    <div>
      <h2>Something went wrong!</h2>
      <button onClick={() => unstable_retry()}>Try again</button>
    </div>
  )
}
```

---

## authentication

Engineering cheat-sheet for the Next.js 16 App Router authentication guide (node_modules/next/dist/docs/01-app/02-guides/authentication.md). Covers the recommended auth flow: Server Actions + useActionState for sign-up/login, stateless (JWT-in-cookie via jose) and database sessions, and authorization via a Data Access Layer (DAL), DTOs, and optimistic checks. The biggest Next.js 16 shifts vs older versions: cookies() is async (must await), and "middleware" is now "Proxy" (proxy.ts, default export named proxy, runs on the Node.js runtime).

**Key APIs**

- **cookies()** — `const cookieStore = await cookies()  // from 'next/headers'`
  - ASYNC in Next.js 16 — must be awaited. Returns a store with .get(name)?.value, .set(name, value, opts), .delete(name). Read-only in Server Components; settable only in Server Actions and Route Handlers. Recommended cookie opts: httpOnly, secure, sameSite:'lax', expires/maxAge, path:'/'. Set cookies on the server only to prevent tampering.
- **Proxy (file convention)** — `// proxy.ts at project root export default async function proxy(req: NextRequest) { ... } export const config = { matcher: [...] }`
  - REPLACES Middleware. File is proxy.ts (not middleware.ts); default export must be named proxy. Runs on EVERY route incl. prefetches — use only for OPTIMISTIC cookie reads, never DB checks. Runs on the Node.js runtime (not Edge by default), so Node-only auth/session libs work; you may need legacy Middleware only if a lib is Edge-only. Not a security boundary on its own.
- **useActionState** — `const [state, action, pending] = useActionState(signup, undefined)`
  - React 19 hook (replaces useFormState). Returns a 3-tuple incl. pending. Bound action goes on <form action={action}>. The Server Action receives (prevState, formData).
- **Server Action** — `'use server' export async function signup(state: FormState, formData: FormData) {}`
  - Always server-side. Treat as a public API endpoint — must do its own verifySession()/role check; client-side UI hiding is NOT sufficient. Signature is (prevState, formData) when driven by useActionState.
- **verifySession (DAL pattern)** — `export const verifySession = cache(async () => { const c = (await cookies()).get('session')?.value; ... })`
  - Centralize authz in a Data Access Layer. Wrap in React cache() to dedupe within a render pass. Mark files 'server-only'. Do auth checks here / close to data — NOT in Layouts (they don't re-render on navigation due to Partial Rendering).
- **redirect()** — `redirect('/login')  // from 'next/navigation'`
  - Used in Server Actions, DAL, and Server Components to bounce unauthorized users. In NextResponse context (Proxy) use NextResponse.redirect(new URL('/login', req.nextUrl)).
- **jose (session encrypt/decrypt)** — `new SignJWT(payload).setProtectedHeader({alg:'HS256'}).setExpirationTime('7d').sign(key); jwtVerify(token, key, {algorithms:['HS256']})`
  - Recommended stateless-session lib; Edge-compatible. Key = new TextEncoder().encode(process.env.SESSION_SECRET). Generate secret via openssl rand -base64 32. Payload should hold minimal data (userId, role) — never passwords/PII.
- **taintUniqueValue** — `import { experimental_taintUniqueValue } from 'react'`
  - Use to prevent sensitive session values from leaking into Client Components. React context is NOT available in Server Components, so auth context providers only reach Client Components.

**Gotchas**

- cookies() (and the other dynamic APIs like headers()/params/searchParams) are ASYNC in Next.js 16 — every call must be awaited. Synchronous `cookies().get(...)` from older Next will break. Doc consistently uses `const cookieStore = await cookies()` or `(await cookies()).get(...)`.
- Middleware is renamed to PROXY. The file is `proxy.ts`/`proxy.js` (not `middleware.ts`), the default export must be named `proxy`, and it runs on the Node.js runtime by default. Legacy `middleware.ts` is only referenced for the case where your auth lib supports Edge Runtime only.
- Proxy runs on every route including prefetched routes — only do optimistic cookie reads there, never database lookups (perf), and never rely on it as your sole security layer. Real checks belong in the DAL, close to the data.
- Do NOT put auth checks in Layouts: due to Partial Rendering they don't re-render on client-side navigation, so the session won't be re-checked on every route change. Check in pages, leaf components, or (best) the DAL.
- Returning null from a top-level component/layout when unauthorized (a common SPA pattern) is explicitly NOT recommended — Next.js apps have multiple entry points; nested segments and Server Actions can still be hit.
- Server Actions and Route Handlers are public-facing endpoints: each must independently call verifySession()/role-check. Hiding UI client-side is not security.
- cookies().set()/delete() only work in Server Actions and Route Handlers, not in Server Components (read-only there).
- useActionState/useFormStatus are React 19 APIs — outside React 19 only the `pending` key is available and the older useFormState naming applies.
- Zod usage in the doc reflects newer Zod: error messages via `{ error: '...' }` (not `{ message: '...' }`) and top-level `z.email()` rather than `z.string().email()`.
- Mark server-only session/DAL/DTO modules with the `server-only` package so they can never be bundled into the client; return DTOs (only safe fields), not whole DB rows.

```tsx
// app/lib/dal.ts
import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { decrypt } from '@/app/lib/session'

export const verifySession = cache(async () => {
  // cookies() is ASYNC in Next.js 16 — must await
  const cookie = (await cookies()).get('session')?.value
  const session = await decrypt(cookie)

  if (!session?.userId) {
    redirect('/login')
  }

  return { isAuth: true, userId: session.userId }
})

// proxy.ts (replaces middleware.ts; default export MUST be named `proxy`)
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decrypt } from '@/app/lib/session'

const protectedRoutes = ['/dashboard']

export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname
  // Optimistic check ONLY — read the cookie, never hit the DB here
  const cookie = (await cookies()).get('session')?.value
  const session = await decrypt(cookie)

  if (protectedRoutes.includes(path) && !session?.userId) {
    return NextResponse.redirect(new URL('/login', req.nextUrl))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'],
}
```

---

## self-hosting

Covers the Next.js 16 App Router self-hosting guide: caching/ISR with the same on-disk server cache, custom cache handlers (single-instance vs multi-instance coordination), runtime env vars under dynamic rendering, multi-server deployment concerns (encryption key, deploymentId/version skew, shared cache), streaming/Suspense proxy config, Cache Components, CDN behavior, and graceful shutdown for `after()`. Note: this specific page does not document the async params/searchParams/cookies/headers signatures — those gotchas below are the Next 16 baseline you must assume, with the one item this page does confirm being `connection()` for runtime env reads.

**Key APIs**

- **connection() from 'next/server'** — `await connection(): Promise<void>`
  - Call inside a Server Component before reading runtime values (e.g. process.env.MY_VALUE). Opts the component into dynamic rendering so env vars are evaluated at request time, not inlined at build. Same effect as reading cookies/headers.
- **cacheHandler (next.config.js)** — `cacheHandler: require.resolve('./cache-handler.js')`
  - Replaces the deprecated experimental.incrementalCacheHandlerPath. Path to a module exporting a class with async get(key)/set(key,data,ctx)/revalidateTag(tags)/resetRequestCache(). ctx.tags carries cache tags; revalidateTag receives a string or string[].
- **cacheMaxMemorySize (next.config.js)** — `cacheMaxMemorySize: 0`
  - Renamed from the old isrMemoryCacheSize. Default in-memory cache is 50mb; set to 0 to disable in-memory caching (do this when using a shared custom handler so pods don't serve divergent in-memory copies).
- **cacheHandlers (next.config.js)** — `cacheHandlers: { /* backends for 'use cache' */ }`
  - Plural, distinct from singular cacheHandler. Configures backends specifically for 'use cache' directives. Use with 'use cache: remote' for cross-instance shared caching.
- **CacheHandler.refreshTags()** — `async refreshTags(): Promise<void>`
  - Multi-instance tag coordination. Called before each request; sync tag state from shared storage (Redis) so revalidateTag() on one instance is seen by others. Without it, other instances serve stale content.
- **revalidateTag() / revalidatePath()** — `revalidateTag(tag) / revalidatePath(path)`
  - revalidatePath is a convenience layer that calls revalidateTag with a special default tag for the page. By default invalidation is per-instance only — needs refreshTags() in the handler for multi-instance.
- **generateBuildId (next.config.js)** — `generateBuildId: async () => string`
  - Return a stable ID (e.g. process.env.GIT_HASH) so multiple containers rebuilt per environment share a build ID.
- **deploymentId (next.config.js)** — `deploymentId: process.env.DEPLOYMENT_VERSION`
  - Version skew protection. Adds ?dpl=<id> to assets and x-deployment-id header to navigations; server compares and forces a hard navigation (full reload, loses useState) on mismatch.
- **NEXT_SERVER_ACTIONS_ENCRYPTION_KEY (env, build-time)** — `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=<base64> next build`
  - Set the same key across all instances or you get 'Failed to find Server Action' errors. Base64-encoded AES key of 16/24/32 bytes (Next generates 32 by default). Embedded in build output, used automatically at runtime.
- **after() from 'next/server'** — `after(callback)`
  - Fully supported with next start (no longer experimental). For graceful shutdown send SIGINT/SIGTERM and allow a 10-30s drain so in-flight requests and pending after() callbacks complete.
- **headers() async config (next.config.js)** — `async headers() => [...]`
  - Used here to set X-Accel-Buffering: no so nginx/proxies don't buffer streamed responses. Source pattern '/:path*{/}?'.

**Gotchas**

- This doc page does NOT show the params/searchParams/cookies/headers signatures, but Next 16 baseline: cookies(), headers(), draftMode() are async (must be awaited), and page/layout params & searchParams are now Promises — await them or use React.use(). Do not destructure them synchronously as in older Next.
- Caching is no longer aggressively-cached-by-default the way Next 14 was: dynamically rendered pages emit Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate. Reading runtime values requires explicitly opting into dynamic rendering via connection() (or cookies/headers).
- Two different config keys that are easy to confuse: cacheHandler (singular) = the ISR/data cache handler; cacheHandlers (plural) = backends for the 'use cache' directive. They are not interchangeable.
- Deprecated/renamed config: experimental.incrementalCacheHandlerPath -> cacheHandler (top-level); isrMemoryCacheSize -> cacheMaxMemorySize.
- Multi-instance footgun: revalidateTag()/revalidatePath() only invalidate the calling instance. Without implementing refreshTags() (and disabling in-memory cache via cacheMaxMemorySize:0 + a shared store), other pods serve stale content. The default in-memory cache is per-instance.
- Multi-instance Server Actions break with cryptic 'Failed to find Server Action' errors unless NEXT_SERVER_ACTIONS_ENCRYPTION_KEY is identical across instances (default key is per-build).
- Streaming/Suspense/PPR require end-to-end non-buffering: nginx X-Accel-Buffering:no, and load balancers/reverse proxies must pass chunked transfer / HTTP/2 streaming (AWS ALB+Lambda and similar buffer by default). Buffering silently kills PPR's TTFB benefit.
- Proxy (the file-convention replacing legacy middleware) runs on the Edge runtime subset by default; full Node.js APIs require opting into the Node.js runtime, else move logic to a Server Component layout or next.config redirects/rewrites.
- Immutable hashed assets get Cache-Control: public, max-age=31536000, immutable that cannot be overridden. ISR uses s-maxage + stale-while-revalidate; revalidate:false defaults to a 1-year cache.
- Graceful shutdown matters now: killing the server without a 10-30s drain can drop in-flight requests and pending after() callbacks. (Pages Router still uses the manual NEXT_MANUAL_SIG_HANDLE path; App Router does it automatically on SIGINT/SIGTERM.)
- Cache Components work with plain next start / Docker — not a CDN-only/Vercel-only feature.

```tsx
// app/page.tsx — read a RUNTIME env var safely in Next.js 16 (App Router)
import { connection } from 'next/server'

export default async function Page() {
  // Opt into dynamic rendering so the value is read at request time,
  // not inlined during `next build`.
  await connection()
  const value = process.env.MY_VALUE
  return <p>{value}</p>
}

// next.config.js — shared cache + stable build id for multi-instance self-hosting
module.exports = {
  cacheHandler: require.resolve('./cache-handler.js'),
  cacheMaxMemorySize: 0, // disable per-instance in-memory cache
  generateBuildId: async () => process.env.GIT_HASH,
  deploymentId: process.env.DEPLOYMENT_VERSION, // version skew protection
}
```

---

## env-vars

Cheat-sheet for env vars in Next.js 16 App Router (v16.2.7), grounded in node_modules/next/dist/docs/01-app/02-guides/environment-variables.md plus the v16 upgrade guide for cross-cutting breaking changes. Covers .env loading/precedence, NEXT_PUBLIC_ build-time inlining vs runtime reads via connection(), @next/env for outside-runtime loading, and the Next 16 breaking changes a senior dev coming from older Next must avoid (fully-async request APIs, removed serverRuntimeConfig/publicRuntimeConfig, caching API changes, middleware→proxy, Turbopack default).

**Key APIs**

- **process.env.<VAR>** — `process.env.DB_HOST // server-only by default`
  - Auto-loaded from .env* into process.env. Non-prefixed vars are server-only (Node runtime / Server Components / Route Handlers). Browser cannot read them.
- **NEXT_PUBLIC_ prefix** — `process.env.NEXT_PUBLIC_ANALYTICS_ID`
  - Only way to expose a var to the browser. INLINED (hard-coded) at `next build` time, not read at runtime. Only STATIC references are inlined — dynamic lookups (process.env[varName] or aliasing const env=process.env) are NOT inlined.
- **connection()** — `import { connection } from 'next/server'; await connection()`
  - Await BEFORE reading process.env on the server to force runtime (dynamic) evaluation instead of build-time bake-in. Enables one Docker image promoted across envs. Also the documented replacement path for runtime config after serverRuntimeConfig removal.
- **loadEnvConfig (@next/env)** — `import { loadEnvConfig } from '@next/env'; loadEnvConfig(process.cwd())`
  - Loads .env* the same way Next does, but OUTSIDE the Next runtime — ORM config files (drizzle/prisma), test runners (Jest globalSetup). Install @next/env separately.
- **Variable expansion** — `TWITTER_URL=https://x.com/$TWITTER_USER`
  - $VAR references other vars inside .env*. Escape a literal dollar as \$.
- **cookies / headers / draftMode** — `const c = await cookies()  // from next/headers`
  - BREAKING in 16: now async-only. The temporary sync compatibility shipped in 15 is fully removed. Must await.
- **params / searchParams** — `async function Page(props: PageProps<'/blog/[slug]'>){ const {slug}=await props.params }`
  - BREAKING in 16: Promises, sync access removed. params in layout/page/route/default/metadata-image files; searchParams in page only. Run `npx next typegen` for PageProps/LayoutProps/RouteContext helpers.
- **serverRuntimeConfig / publicRuntimeConfig** — `// REMOVED — next/config getConfig() gone`
  - Removed in 16. Replace server values with direct process.env in Server Components (optionally guard with taint API); replace client values with NEXT_PUBLIC_. Use connection() for true runtime reads.
- **revalidateTag** — `revalidateTag('posts', 'max')`
  - BREAKING in 16: second arg (cacheLife profile) now REQUIRED; single-arg form is a TS error. Stale-while-revalidate semantics.
- **updateTag / refresh** — `updateTag('user-123') ; refresh()  // from next/cache`
  - New Server-Action-only APIs. updateTag = read-your-writes (expire + refresh same request). refresh = refresh client router after an action.
- **cacheLife / cacheTag** — `import { cacheLife, cacheTag } from 'next/cache'`
  - Stable in 16 — drop the unstable_ prefix and the aliased imports.
- **cacheComponents (next.config)** — `{ cacheComponents: true }`
  - Top-level config replacing experimental.dynamicIO + experimental.useCache (deprecated) and the removed experimental_ppr / experimental.ppr flags. This is how PPR is opted into in 16; its behavior differs from 15-canary PPR.

**Gotchas**

- NEXT_PUBLIC_ values are FROZEN at build time — promoting a prebuilt slug/Docker image across environments will carry the build-time value. For runtime client values, expose your own API; for runtime server values, `await connection()` before reading process.env.
- Only literal `process.env.NEXT_PUBLIC_FOO` references get inlined. `process.env[dynamicName]` and destructuring `const env = process.env; env.NEXT_PUBLIC_FOO` are NOT inlined and will be undefined in the browser.
- Env load precedence (first hit wins): process.env > .env.$(NODE_ENV).local > .env.local > .env.$(NODE_ENV) > .env. In test, .env.local is intentionally SKIPPED so tests are reproducible.
- NODE_ENV only accepts production | development | test. Unset → development for `next dev`, production otherwise.
- With a /src dir, .env.* must stay at the PROJECT ROOT — Next does NOT read them from /src.
- serverRuntimeConfig/publicRuntimeConfig and next/config getConfig() are REMOVED in 16 — code relying on them breaks; migrate to env vars.
- Async request APIs are fully sync-removed in 16: any leftover sync cookies()/headers()/draftMode()/params/searchParams usage from a 15 codebase will break. params/id in opengraph-image/twitter-image/icon/apple-icon and id in sitemap (via generateSitemaps) are also Promises now.
- middleware is deprecated/renamed to `proxy` (proxy.ts, export `proxy`); proxy runs node-only (no edge runtime) and isn't configurable — keep middleware if you need edge. Flags like skipMiddlewareUrlNormalize → skipProxyUrlNormalize.
- Turbopack is default for `next dev` AND `next build` in 16; a custom webpack config makes `next build` FAIL unless you pass --webpack (or migrate). experimental.turbopack moved to top-level `turbopack`.
- next/image defaults changed: minimumCacheTTL 60s→4h, qualities now [75] only, imageSizes dropped 16, maximumRedirects→3, local IP optimization blocked (dangerouslyAllowLocalIP), local images with query strings need images.localPatterns.search. images.domains and next/legacy/image are deprecated.
- Removed: AMP (next/amp, amp config), `next lint` (use ESLint/Biome directly; build no longer lints), unstable_rootParams, several devIndicators options. Min Node 20.9, TS 5.1.
- All parallel-route slots now REQUIRE an explicit default.js or the build fails.
- Next no longer overrides CSS scroll-behavior: smooth on navigation — add data-scroll-behavior="smooth" to <html> to restore old behavior.

```tsx
// app/page.tsx — runtime (not build-time) server env read in Next.js 16
import { connection } from 'next/server'

export default async function Page() {
  await connection() // opt into dynamic rendering -> evaluated at runtime
  const dbUrl = process.env.DATABASE_URL          // server-only, runtime value
  const publicId = process.env.NEXT_PUBLIC_ANALYTICS_ID // inlined at build time
  return <p>{publicId}</p>
}

// .env (project root, even with /src). Precedence: .env.local > .env
// DATABASE_URL=postgres://localhost/app
// NEXT_PUBLIC_ANALYTICS_ID=abc123
```

---

## forms

Covers building forms in the Next.js 16 App Router using React Server Actions (Server Functions). The canonical pattern: attach an async function to <form action={...}>, mark it 'use server', and it auto-receives a FormData object. Pairs with React 19 hooks (useActionState, useFormStatus, useOptimistic) for validation errors, pending UI, and optimistic updates. Note: this guide does not document params/searchParams/cookies/headers or caching directly — those live in other Next 16 guides and must be read there before use.

**Key APIs**

- **Inline Server Action** — `async function action(formData: FormData) { 'use server'; ... }`
  - Defined inside a Server Component or a 'use server' module. Wired via <form action={action}>. Read fields with formData.get('name').
- **FormData extraction** — `formData.get('field') | Object.fromEntries(formData)`
  - Object.fromEntries gives all fields at once but includes extra $ACTION_-prefixed props you must strip/ignore.
- **.bind for extra args** — `const a = action.bind(null, userId)`
  - Prepends bound args; server fn signature becomes (userId, formData). Works in Server + Client Components and preserves progressive enhancement. Prefer over hidden inputs (hidden inputs are unencoded plaintext in HTML).
- **useActionState** — `const [state, formAction, pending] = useActionState(action, initialState)`
  - React 19 hook (import from 'react', NOT useFormState from react-dom — that's the old name). Changes the action signature to (prevState, formData) — prevState becomes the FIRST arg. Returns a 3-tuple including pending. Action's return value becomes next state; render errors from it.
- **useFormStatus** — `const { pending, data, method, action } = useFormStatus()`
  - Import from 'react-dom'. MUST be called in a child component nested inside the <form>, not the form component itself. React 19 adds data/method/action keys beyond pending.
- **useOptimistic** — `const [optimistic, addOptimistic] = useOptimistic(state, reducer)`
  - Import from 'react'. Call addOptimistic before awaiting the server fn to update UI instantly; reconciles when the action resolves.
- **Multiple submit actions** — `<button formAction={otherAction}>`
  - Nested <button>/<input type=submit|image> accept formAction to invoke different Server Actions from one form (e.g. save-draft vs publish).
- **Programmatic submit** — `el.form?.requestSubmit()`
  - Use requestSubmit() (not form.submit()) so validation + the Server Action fire. Common for Cmd/Ctrl+Enter handlers.

**Gotchas**

- useActionState changes your server function signature: the action MUST be (prevState, formData) with prevState first. If you wrote (formData) for a plain action, adding useActionState silently shifts FormData to the 2nd arg.
- Hook renames vs older Next/React: it's useActionState (from 'react'), not the deprecated useFormState (from 'react-dom'). pending now comes straight out of useActionState's tuple.
- useFormStatus only works in a component rendered INSIDE the <form>; calling it in the same component that renders <form> returns pending:false forever.
- Object.fromEntries(formData) injects $ACTION_-prefixed entries — don't pass that object straight into a DB write or schema without filtering.
- Hidden inputs (<input type=hidden>) are NOT encoded — value is visible in rendered HTML. Use .bind() to pass server-side values you don't want exposed.
- Security is not implied by an authenticated page: every Server Action is a public POST endpoint, so re-verify auth/authz inside each action (the guide opens with this warning).
- This is Next.js 16 (16.2.7) with breaking changes — params/searchParams are async (await them / they're Promises) and cookies()/headers()/draftMode() are async and must be awaited; caching defaults changed from older Next. None of that is in forms.md; read the dedicated guides under node_modules/next/dist/docs/ (e.g. caching-without-cache-components.md, how-revalidation-works.md) before relying on memory.
- After mutating in an action, you must explicitly revalidate (revalidatePath/revalidateTag) or redirect — the guide marks these as // revalidate the cache TODOs; nothing is auto-fresh.

```tsx
// app/actions.ts
'use server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'

const schema = z.object({ email: z.string().email() })

// useActionState signature: prevState FIRST, then formData
export async function createUser(_prev: unknown, formData: FormData) {
  // re-check auth here in real code — actions are public endpoints
  const parsed = schema.safeParse({ email: formData.get('email') })
  if (!parsed.success) {
    return { message: 'Invalid email' }
  }
  // ...mutate...
  revalidatePath('/users')
  return { message: 'Created' }
}

// app/ui/signup.tsx
'use client'
import { useActionState } from 'react'
import { createUser } from '@/app/actions'

export function Signup() {
  const [state, formAction, pending] = useActionState(createUser, { message: '' })
  return (
    <form action={formAction}>
      <input type="email" name="email" required />
      <p aria-live="polite">{state?.message}</p>
      <button disabled={pending}>Sign up</button>
    </form>
  )
}
```

---
