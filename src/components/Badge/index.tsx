// @ts-nocheck
import { Badge as BadgeBase } from 'react-bootstrap';
import React from 'react';

interface BadgeProps {
  id: string | number;
  children: React.ReactNode;
  textColor: any;
  bgColor: string;
}

export const Badge: React.FC<BadgeProps> = ({
  id,
  children,
  textColor,
  bgColor,
}) => (
  <BadgeBase bg={bgColor} key={id} text={textColor}>
    {children}
  </BadgeBase>
);
