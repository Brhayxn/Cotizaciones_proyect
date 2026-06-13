export default function GlassCard({ children, className = '', as: Tag = 'section' }) {
  return (
    <Tag className={`glass-card rounded-[1.35rem] border border-white/10 p-4 sm:rounded-[2rem] sm:p-5 ${className}`}>
      {children}
    </Tag>
  );
}
