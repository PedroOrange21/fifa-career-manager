import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';

export default function ConfirmModal({
  icon: Icon, iconClassName = 'text-red-500', title, message,
  confirmLabel = 'Sí, Borrar', confirmClassName = 'bg-red-500 text-black shadow-red-500/20 hover:bg-red-400',
  borderClassName = 'border-border', zIndexClassName = 'z-[200]',
  onConfirm, onCancel,
}) {
  useBodyScrollLock();
  return (
    <div className={`fixed inset-0 bg-black/95 ${zIndexClassName} flex items-center justify-center p-4 animate-in fade-in duration-200`} onClick={onCancel}>
      <div className={`bg-surface border ${borderClassName} p-6 rounded-[32px] w-full max-w-sm text-center shadow-2xl`} onClick={(e) => e.stopPropagation()}>
        <Icon className={`${iconClassName} mx-auto mb-4`} size={40} />
        <h3 className="text-lg font-black uppercase italic mb-2 text-fg">{title}</h3>
        <p className="text-[10px] text-fg-muted mb-6 font-bold uppercase tracking-widest">{message}</p>
        <div className="flex gap-3">
          <button type="button" onClick={onCancel} className="flex-1 py-4 rounded-2xl bg-well text-fg-muted font-black uppercase text-[10px] hover:bg-well-strong transition-all active:scale-95">Cancelar</button>
          <button type="button" onClick={onConfirm} className={`flex-1 py-4 rounded-2xl font-black uppercase text-[10px] shadow-lg transition-all active:scale-95 ${confirmClassName}`}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
