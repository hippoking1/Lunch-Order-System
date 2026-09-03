import cn from 'classnames';

export function SkeletonText({ className }: { className?: string }) {
  return <div className={cn('skeleton skeleton-text', className)} />;
}

export function SkeletonCard({ className }: { className?: string }) {
  return <div className={cn('skeleton skeleton-card', className)} />;
}

export function SkeletonGrid({ count }: { count: number }) {
  return (
    <div className="option-grid">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function OrderingSkeleton() {
  return (
    <div className="flex-col gap-5">
      {/* Header skeleton */}
      <div className="flex justify-between items-center">
        <div>
          <div className="skeleton skeleton-text" style={{ width: '120px' }} />
          <div
            className="skeleton skeleton-title"
            style={{ width: '200px' }}
          />
        </div>
        <div className="skeleton skeleton-avatar" />
      </div>

      {/* Category selector skeleton */}
      <div className="skeleton" style={{ height: '48px', width: '100%' }} />

      {/* Restaurant grid skeleton */}
      <div>
        <div
          className="skeleton skeleton-text mb-3"
          style={{ width: '80px' }}
        />
        <SkeletonGrid count={6} />
      </div>

      {/* Menu grid skeleton */}
      <div>
        <div
          className="skeleton skeleton-text mb-3"
          style={{ width: '80px' }}
        />
        <SkeletonGrid count={8} />
      </div>
    </div>
  );
}

export function SummarySkeleton() {
  return (
    <div className="flex-col gap-4">
      {/* Title */}
      <div className="skeleton skeleton-title" style={{ width: '160px' }} />

      {/* Summary cards */}
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="card">
          <div className="flex justify-between items-center mb-3">
            <div
              className="skeleton skeleton-text"
              style={{ width: '100px' }}
            />
            <div
              className="skeleton skeleton-text"
              style={{ width: '60px' }}
            />
          </div>
          <SkeletonText />
          <SkeletonText />
          <SkeletonText />
        </div>
      ))}
    </div>
  );
}
