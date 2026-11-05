/**
 * Public surface of the Damazon design system.
 *
 * This package is neutral: it contains tokens, layout primitives, glass
 * surfaces, bento cells, and controls. It contains no role-specific styling and
 * no administrative screens, which is what keeps the admin console isolated
 * from the consumer application while both share one visual foundation
 * (ADR-0008).
 */

export * from './tokens/index.js';
export * from './core/primitives.js';

export {
  BentoCard,
  BentoContainer,
  BentoGrid,
  BentoHero,
  BentoSection,
} from './components/bento.js';
export type {
  BentoCardProps,
  BentoContainerProps,
  BentoGridProps,
  BentoHeroProps,
  BentoSectionProps,
  BentoSpanProps,
} from './components/bento.js';

export { Button, IconButton } from './components/button.js';
export type {
  ButtonProps,
  ButtonSize,
  ButtonVariant,
  IconButtonProps,
} from './components/button.js';

export { Checkbox, FieldShell, SelectField, TextAreaField, TextField } from './components/form.js';
export type {
  CheckboxProps,
  FieldShellProps,
  SelectFieldProps,
  SelectOption,
  TextAreaFieldProps,
  TextFieldProps,
} from './components/form.js';

export {
  Avatar,
  Badge,
  EmptyState,
  ProgressBar,
  Skeleton,
  Spinner,
} from './components/feedback.js';
export type {
  AvatarProps,
  BadgeProps,
  EmptyStateProps,
  ProgressBarProps,
  SkeletonProps,
  SpinnerProps,
} from './components/feedback.js';

export { DataTable, Pagination } from './components/data-display.js';
export type {
  DataTableColumn,
  DataTableProps,
  PaginationProps,
} from './components/data-display.js';

export { AppShell, Cluster, Divider, Stack } from './components/layout.js';
export type { AppShellProps, ClusterProps, DividerProps, StackProps } from './components/layout.js';

export {
  GlassBottomSheet,
  GlassCard,
  GlassContainer,
  GlassModal,
  GlassNavigation,
  GlassPanel,
} from './components/glass.js';
export type {
  GlassBottomSheetProps,
  GlassCardProps,
  GlassModalProps,
  GlassNavigationProps,
  GlassPanelProps,
  GlassSurfaceProps,
} from './components/glass.js';

export { formatDesignTokens, tokenCustomProperties } from './tokens/css-variables.js';
