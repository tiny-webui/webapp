This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Interactive Dev Demos

Development pages for manually exploring the components without a backend.

Run the dev server and open:

```
npm run dev
```

Entry points:

* Side bar

http://localhost:3000/dev/side-demo

* User input

http://localhost:3000/dev/user-input-demo

* Message (single message preview)

http://localhost:3000/dev/message-demo

These pages are purely for local manual testing and are not intended for production deployment.

### Static Export Without Dev Pages

When generating a static bundle (e.g. deploying to a plain static host), use:

```
npm run build:static
```

This script will:
1. Temporarily move `src/app/dev` to `.dev-pages.stash` before `next build`.
2. Run `next build` (which emits a fully static site to `out/` because of `output: 'export'` in the config).
3. Restore the dev pages directory afterward so local development can continue.

Artifacts `.dev-pages.stash` and marker `.dev-pages-removed` are git‑ignored.

Result: No `/dev/*` HTML or assets are included in the exported static site.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
