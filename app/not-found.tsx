import Link from 'next/link';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h2 className="text-2xl font-bold">404 — Page Not Found</h2>
      <p className="text-muted-foreground">The page you're looking for doesn't exist.</p>
      <Link
        href="/"
        className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
      >
        Go home
      </Link>
    </div>
  );
}
