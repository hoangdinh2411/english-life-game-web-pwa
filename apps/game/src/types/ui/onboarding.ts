import type { PropsWithChildren } from 'react';
export interface AvatarPreviewProps {
  color: string;
  large?: boolean;
}
export type ChoiceCardProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
  selected: boolean;
  onClick: () => void;
}>;
export interface ActionButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  secondary?: boolean;
}
export interface HeadingProps {
  title: string;
  subtitle?: string;
}
