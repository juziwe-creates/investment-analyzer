type PagePlaceholderProps = {
  title: string;
  description: string;
};

export function PagePlaceholder({ title, description }: PagePlaceholderProps) {
  return (
    <div className="space-y-8">
      <header className="border-b border-border/70 pb-6">
        <p className="alpha-kpi-label">Alpha workspace</p>
        <h1 className="mt-2 text-3xl font-medium tracking-[-0.03em]">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </header>
      <section className="alpha-surface flex min-h-72 items-center justify-center p-8 text-center">
        <div>
          <p className="text-lg font-medium">{title} foundation</p>
          <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
            This destination is in place and will receive the next analytical workflow
            once the core portfolio views are validated.
          </p>
        </div>
      </section>
    </div>
  );
}
