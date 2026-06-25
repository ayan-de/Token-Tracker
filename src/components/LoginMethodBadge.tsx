interface LoginMethodBadgeProps {
  loginMethod: string;
}

export default function LoginMethodBadge({ loginMethod }: LoginMethodBadgeProps) {
  return (
    <span className="relative overflow-hidden text-xs font-semibold px-2.5 py-1 rounded-full glass-shine-badge text-text-main select-none">
      {loginMethod}
    </span>
  );
}
