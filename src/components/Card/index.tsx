// @ts-nocheck
import { type FC } from 'react';
import { Card as CardBase } from 'react-bootstrap';
import { Badge } from '../Badge';
/**
 * @param {string} color: add a line on the left side
 * @param {string} title: add a title on the Card, if title exists not use color
 * @param {Boolean} container: set the card max width 960px.
 * @param {function} onTitleClick: callback when user click title or image
 * @param {Object} classes: object with class of every component on the card
 */

export const Card: FC<any> = ({
  id,
  title,
  className,
  onTitleClick,
  container,
  color,
  image,
  type,
  classes,
  children,
  ...props
}: any) => {
  let classesCard = `shadow ${title ? '' : 'h-100 py-2'} ${className}`;
  const pointer = onTitleClick ? 'm_pointer' : '';

  if (container) classesCard = `${classesCard} card__container`;
  if (color && !title) classesCard = `${classesCard} border-left-${color}`;

  return (
    <CardBase {...props} className={classesCard}>
      {title && (
        <CardBase.Header className="py-3">
          <h6
            className={`m-0 font-weight-bold text-primary ${pointer}`}
            onClick={onTitleClick}
          >
            {title}
          </h6>
          {type && (
            <Badge
              id={id}
              children={type === 'inlive' ? 'En vivo' : 'En linea'}
              bgColor={type === 'inlive' ? 'danger' : 'info'}
              textColor="white"
            />
          )}
        </CardBase.Header>
      )}
      {image && (
        <CardBase.Img
          variant="top"
          src={image}
          onClick={() => onTitleClick?.()}
          className={`${classes.image} ${pointer}`}
        />
      )}
      <CardBase.Body>{children}</CardBase.Body>
    </CardBase>
  );
};
