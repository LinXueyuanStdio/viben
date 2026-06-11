/**
 * Selector Types
 *
 * 纯UI数据类型，与业务数据解耦。
 * 业务层负责将Provider/Model等业务数据转换为这些UI类型。
 */

import type { ReactNode } from "react";

// ============================================================================
// 统一的选项类型
// ============================================================================

/** 通用选择器选项 */
export interface SelectorOption {
  id: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  disabled?: boolean;
  /** 右侧标签 (如 "default", "beta") */
  badge?: string;
  /** 子选项 (用于级联选择) */
  children?: SelectorOption[];
}

// ============================================================================
// 三联选择器
// ============================================================================

export interface TripleSelectorValue {
  first: string | null;
  second: string | null;
  third: string | null;
}

/** displayLabel 格式化函数的参数 */
export interface DisplayLabelFormatParams {
  first: SelectorOption | undefined;
  second: SelectorOption | undefined;
  third: SelectorOption | undefined;
}

export interface TripleSelectorProps {
  /** 第一级选项 (如 Agent Type) */
  firstOptions: SelectorOption[];
  /** 第一级标签 */
  firstLabel?: string;
  /** 第一级占位符 */
  firstPlaceholder?: string;

  /** 第二级选项 (如 Provider) */
  secondOptions: SelectorOption[];
  /** 第二级标签 */
  secondLabel?: string;
  /** 第二级占位符 */
  secondPlaceholder?: string;

  /** 第三级选项 (如 Model) */
  thirdOptions: SelectorOption[];
  /** 第三级标签 */
  thirdLabel?: string;
  /** 第三级占位符 */
  thirdPlaceholder?: string;

  /** 当前选中值 */
  value: TripleSelectorValue;
  /** 选中值变化回调 */
  onChange?: (value: TripleSelectorValue) => void;

  /** 隐藏第一级 */
  hideFirst?: boolean;
  /** 隐藏第二级 */
  hideSecond?: boolean;
  /** 隐藏第三级 */
  hideThird?: boolean;

  /** 加载状态 */
  isLoading?: boolean;
  /** 禁用状态 */
  disabled?: boolean;
  /** 紧凑模式 - 单按钮展开弹窗 */
  compact?: boolean;
  /** 自定义 displayLabel 格式化函数 (仅 compact 模式生效) */
  formatDisplayLabel?: (params: DisplayLabelFormatParams) => string;
  /** 额外类名 */
  className?: string;
}

// ============================================================================
// 单级选择器
// ============================================================================

export interface SingleSelectorProps {
  options: SelectorOption[];
  value: string | null;
  onChange?: (value: string) => void;
  label?: string;
  placeholder?: string;
  icon?: ReactNode;
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
}
