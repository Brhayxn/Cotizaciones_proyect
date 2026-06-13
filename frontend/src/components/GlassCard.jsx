export default function GlassCard({ children, className = '', as: Tag = 'section' }) {
  return (
    <Tag className={`glass-card rounded-[2rem] border border-white/10 p-5 shadow-soft ${className}`}>
      {children}
    </Tag>
  );
}
