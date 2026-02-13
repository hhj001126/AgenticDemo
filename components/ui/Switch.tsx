import React, { memo } from "react";
import { cn } from "../../utils/classnames";

export interface SwitchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange" | "children"> {
  /** 是否开启 */
  checked: boolean;
  /** 状态变化回调 */
  onChange?: (checked: boolean) => void;
  /** 是否禁用 */
  disabled?: boolean;
  /** 开启时轨道内显示的内容（如 "开"、图标） */
  checkedChildren?: React.ReactNode;
  /** 关闭时轨道内显示的内容（如 "关"、图标） */
  unCheckedChildren?: React.ReactNode;
  /** 无障碍标签 */
  "aria-label"?: string;
  className?: string;
}

const TRACK_W = 44;
const TRACK_W_WITH_CHILDREN = 52;
const THUMB_SIZE = 20;
const THUMB_OFFSET = 2;
const GAP = 6;

/**
 * 开关组件：轨道 + 滑块，支持 Ant Design 风格轨道内文案/图标
 * 文案区域用 left/width 明确划分，避免与滑块重叠或错位
 */
export const Switch = memo<SwitchProps>(
  ({
    checked,
    onChange,
    disabled = false,
    checkedChildren,
    unCheckedChildren,
    className,
    "aria-label": ariaLabel,
    ...props
  }) => {
    const hasChildren = checkedChildren != null || unCheckedChildren != null;
    const trackWidth = hasChildren ? TRACK_W_WITH_CHILDREN : TRACK_W;
    const thumbX = checked ? trackWidth - THUMB_SIZE - THUMB_OFFSET : THUMB_OFFSET;
    const trackHeight = 22;

    return (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel ?? (checked ? "已启用" : "已禁用")}
        disabled={disabled}
        onClick={() => onChange?.(!checked)}
        style={{ width: trackWidth, height: trackHeight }}
        className={cn(
          "relative inline-flex shrink-0 rounded-full border-0 transition-colors duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2",
          checked ? "bg-primary-500" : "bg-surface-muted",
          disabled && "cursor-not-allowed opacity-50",
          !disabled && (checked ? "hover:bg-primary-600" : "hover:bg-border-muted"),
          className
        )}
        {...props}
      >
        {hasChildren && (
          <>
            {/* 开：仅占轨道左侧，不侵入滑块区 */}
            <span
              className={cn(
                "absolute top-0 bottom-0 flex items-center overflow-hidden pointer-events-none transition-opacity duration-200",
                checked ? "opacity-100" : "opacity-0"
              )}
              style={{
                left: GAP,
                width: Math.max(0, thumbX - GAP),
              }}
            >
              <span className="text-[10px] font-medium leading-none text-white truncate">
                {checkedChildren}
              </span>
            </span>
            {/* 关：仅占轨道右侧，不侵入滑块区 */}
            <span
              className={cn(
                "absolute top-0 bottom-0 flex items-center justify-end overflow-hidden pointer-events-none transition-opacity duration-200",
                !checked ? "opacity-100" : "opacity-0"
              )}
              style={{
                left: thumbX + THUMB_SIZE + GAP,
                right: GAP,
              }}
            >
              <span className="text-[10px] font-medium leading-none text-text-muted truncate">
                {unCheckedChildren}
              </span>
            </span>
          </>
        )}
        <span
          className="pointer-events-none absolute left-0 top-1/2 z-10 inline-block rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ease-out"
          style={{
            width: THUMB_SIZE,
            height: THUMB_SIZE,
            transform: `translate(${thumbX}px, -50%)`,
          }}
        />
      </button>
    );
  }
);
