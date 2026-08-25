import { ReactNode, Children, isValidElement } from 'react';
import { NodeColorPicker } from './ColorPicker';
import { BaseNodeData } from '../../types';



interface NodeWrapperProps {
  id: string;
  data: BaseNodeData;
  children: ReactNode;
}

export function NodeWrapper({ id, data, children }: NodeWrapperProps) {
  
  const bgColor = data.backgroundColor && data.backgroundColor !== 'transparent' 
    ? `${data.backgroundColor}15`
    : 'var(--color-card)';

  const borderColor = data.backgroundColor && data.backgroundColor !== 'transparent'
    ? `${data.backgroundColor}50`
    : 'var(--color-border)';

  // Find the NodeHeader child so we can still render it in JSON view if needed, but we don't use it anymore
  const headerChild = Children.toArray(children).find(
    (child) => isValidElement(child) && child.type === NodeHeader
  );

  return (
    <>
      <NodeColorPicker nodeId={id} />

      <div 
        style={{ 
          borderRadius: 'calc(var(--theme-radius) - 1px)', 
          overflow: 'hidden',
          backgroundColor: bgColor,
          borderColor: borderColor,
          borderWidth: 1,
          borderStyle: 'solid',
          opacity: data.opacity !== undefined ? (data.opacity as number) / 100 : 1
        }}
        className="transition-colors duration-200 relative"
      >
        {children}
      </div>
    </>
  );
}

export function NodeHeader({ 
  title, 
  icon, 
  badge, 
  backgroundColor 
}: { 
  title: string, 
  icon: ReactNode, 
  badge: string,
  backgroundColor?: string
}) {
  const headerBgColor = backgroundColor && backgroundColor !== 'transparent'
    ? `${backgroundColor}30` // slightly stronger tint for header
    : 'var(--color-surface)';
    
  const borderColor = backgroundColor && backgroundColor !== 'transparent'
    ? `${backgroundColor}50`
    : 'var(--color-border)';

  return (
    <div 
      className="px-3 py-2 flex items-center justify-between transition-colors duration-200"
      style={{ 
        backgroundColor: headerBgColor,
        borderBottomWidth: 1,
        borderBottomColor: borderColor,
        borderBottomStyle: 'solid'
      }}
    >
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="font-semibold text-[15px] text-text-main tracking-wide">{title}</h3>
      </div>
      <span className="text-[11px] px-2 py-0.5 bg-surface/50 border border-border/50 text-text-muted rounded-full font-mono uppercase tracking-widest">{badge}</span>
    </div>
  );
}
