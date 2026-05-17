// @ts-nocheck
export interface ButtonType {
  value: string;
  onClick?: () => void;
  type?: string;
  className?: string;
  icon?: string;
  group?: string;
  disabled?: boolean;
  [k: string]: any;
}

export interface ButtonLinkType {
  to: string;
  value: string;
  className?: string;
  group?: string;
  icon?: string;
  disabled?: boolean;
  [k: string]: any;
}
