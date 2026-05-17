// @ts-nocheck
import { type FC } from 'react';
import { Button as ButtonBase } from 'react-bootstrap';
import { ButtonType } from './ButtonType';

/**
 * @param {string} icon: if there icon show a icon on the left side of the button.
 * @param {string} group: to use a group of font-awesome by default "fas".
 * @param {string} value: the text of the button.
 * @param {string} type: the type of the button.
 */

export const Button: FC<ButtonType> = ({
  className: classNameBase,
  group: groupBase,
  icon,
  onClick,
  value,
  type,
  ...props
}: any) => {
  let className = classNameBase || '';
  const group = groupBase || 'fas';
  if (icon) className = `${className} btn-icon-split`;

  return (
    <ButtonBase
      type={type}
      className={className}
      onClick={() => onClick?.()}
      {...props}
    >
      {icon && (
        <span className="icon px-2">
          <i className={`${group} fa-${icon}`} />
        </span>
      )}
      <span className="text">{value}</span>
    </ButtonBase>
  );
};
