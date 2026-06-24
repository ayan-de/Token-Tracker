interface LoginMethodBadgeProps {
  loginMethod: string;
}

export default function LoginMethodBadge({ loginMethod }: LoginMethodBadgeProps) {
  return (
    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-bg-subtle text-text-main border border-border-subtle">
      {loginMethod}
    </span>
  );
}
