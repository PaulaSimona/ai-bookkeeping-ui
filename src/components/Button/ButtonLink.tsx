// @ts-nocheck
import { type FC } from 'react';
import { Link } from 'react-router-dom';
import { Button as ButtonBase } from 'react-bootstrap';
import { type ButtonLinkType } from './ButtonType';

/**
 * @param {string} icon: if there icon show a icon on the left side of the button.
 * @param {string} to: path to redirect.
 * @param {string} group: to use a group of font-awesome by default "fas".
 */

export const LinkButton: FC<ButtonLinkType> = ({
  className: classNameBase,
  group: groupBase,
  icon,
  to,
  value,
  ...props
}: any) => {
  let className = classNameBase || '';
  const group = groupBase || 'fas';
  if (icon) className = `${className} btn-icon-split`;

  return (
    <ButtonBase {...props} className={className} to={to} as={Link}>
      {icon && (
        <span className="icon text-white-50">
          <i className={`${group} fa-${icon}`} />
        </span>
      )}
      <span className="text">{value}</span>
    </ButtonBase>
  );
};
