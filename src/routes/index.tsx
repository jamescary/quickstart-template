import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/')({ component: Landing })

function Landing() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center gap-6 px-8 py-24 text-center">
      <h1 className="max-w-2xl text-4xl font-bold tracking-tight">
        Build full-stack on Cloudflare in minutes.
      </h1>
      <p className="max-w-md text-muted-foreground">
        TanStack Start, Drizzle, D1, KV, Durable Objects, better-auth — all
        wired up and ready to ship.
      </p>
      <div className="flex gap-2">
        <Link to="/login">
          <Button variant="outline">Sign in</Button>
        </Link>
        <Link to="/signup">
          <Button>Get started</Button>
        </Link>
      </div>
    </main>
  )
}
