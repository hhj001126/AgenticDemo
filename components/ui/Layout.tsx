import React, { memo } from 'react';
import { cn } from '../../utils/classnames';

/**
 * 应用主布局：侧边栏 + 主内容区
 */
interface AppLayoutProps {
  sidebar: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const AppLayout = memo<AppLayoutProps>(({ sidebar, children, className }) => (
  <div className={cn('flex h-screen w-full font-body app-bg', className)}>
    {sidebar}
    <main className="flex-1 p-4 h-full flex flex-col overflow-hidden">
      {children}
    </main>
  </div>
));

/**
 * 主内容区：可滚动容器，带 flex 布局
 */
interface MainContentProps {
  children: React.ReactNode;
  className?: string;
}

export const MainContent = memo<MainContentProps>(({ children, className }) => (
  <div className={cn('flex-1 relative overflow-hidden', className)}>
    {children}
  </div>
));

/**
 * 页面容器：标准内容区块，带内边距、圆角、背景
 * 用于 dashboard / knowledge / vector / mcp 等页面
 */
interface PageContainerProps {
  children?: React.ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  className?: string;
}

const paddingMap = { none: '', sm: 'p-4', md: 'p-6', lg: 'p-8' };

export const PageContainer = memo<PageContainerProps>(
  ({ children, padding = 'md', className }) => (
    <div
      className={cn(
        'h-full bg-surface rounded-card border border-border shadow-card overflow-y-auto transition-theme',
        paddingMap[padding],
        className
      )}
    >
      {children}
    </div>
  )
);

/**
 * 聊天面板容器：可伸缩的对话/工作区布局
 */
interface ChatPanelLayoutProps {
  chat: React.ReactNode;
  workspace?: React.ReactNode;
  showWorkspace: boolean;
  className?: string;
}

export const ChatPanelLayout = memo<ChatPanelLayoutProps>(
  ({ chat, workspace, showWorkspace, className }) => (
    <div className={cn('flex h-full gap-4 overflow-hidden', className)}>
      <div
        className={cn(
          'flex flex-col h-full bg-surface rounded-card border border-border shadow-card overflow-hidden transition-theme duration-500',
          showWorkspace ? 'w-[45%]' : 'w-full'
        )}
      >
        {chat}
      </div>
      {showWorkspace && workspace && (
        <div className="flex-1 h-full min-w-0">{workspace}</div>
      )}
    </div>
  )
);
