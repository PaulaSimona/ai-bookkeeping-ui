import { DragEvent, FC } from 'react';

export type PresentationalProps = {
  dragging: boolean;
  file: File | null;
  noFileText: boolean;
  text: string;
  errors: string[];
  small: boolean;
  onDrag(event: DragEvent<HTMLDivElement>): void;
  onDragStart(event: DragEvent<HTMLDivElement>): void;
  onDragEnd(event: DragEvent<HTMLDivElement>): void;
  onDragOver(event: DragEvent<HTMLDivElement>): void;
  onDragEnter(event: DragEvent<HTMLDivElement>): void;
  onDragLeave(event: DragEvent<HTMLDivElement>): void;
  onDrop(event: DragEvent<HTMLDivElement>): void;
  children: any;
};

/* eslint-enable */
export const FileUploaderPresentationalComponent: FC<PresentationalProps> = ({
  dragging,
  file,
  errors,
  onDrag,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragEnter,
  onDragLeave,
  onDrop,
  children,
  noFileText = true,
  text,
  small,
}) => {
  let uploaderClasses = `dnd ${small && 'small'}`;
  if (dragging) {
    uploaderClasses += ' dnd--dragging';
  }

  const fileName = file ? file.name : noFileText;

  return (
    <div
      className={uploaderClasses}
      onDrag={onDrag}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="file-uploader__contents dnd-container pt-5">
        {noFileText && (
          <span className="file-uploader__file-name">{fileName}</span>
        )}
        <span>{text}</span>
        {errors && (
          <ul className="m-0 p-0">
            {errors.map((error) => (
              <li key={error} className="dnd-error text-danger">
                {error}
              </li>
            ))}
          </ul>
        )}
        {children}
      </div>
    </div>
  );
};
