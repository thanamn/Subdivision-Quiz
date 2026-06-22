export function NoticeBar({ notice }: { notice: string }) {
  return (
    <div className="notice" aria-live="polite">
      {notice}
    </div>
  );
}
