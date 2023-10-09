import { DragEvent, ChangeEvent, FC, useEffect, useRef, useState } from 'react';

import { FileUploaderPresentationalComponent } from './FileUploaderPresentationalComponent';
import { Button } from '../Button/Button';

type Props = {
  onSubmitted: (a: any) => void;
  buttonText: string;
  noFileText?: boolean;
  text: string;
  errors: string[];
  multiple?: boolean;
  small?: boolean;
};

export const FileUploader: FC<Props> = ({
  onSubmitted,
  buttonText,
  noFileText = true,
  text,
  errors,
  multiple = false,
  small = false,
}) => {
  let dragEventCounter = 0;
  const fileUploaderInput = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<any>(null);

  const overrideEventDefaults = (event: Event | DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const dragenterListener = (event: DragEvent<HTMLDivElement>) => {
    overrideEventDefaults(event);
    dragEventCounter += 1;
    if (event.dataTransfer.items && event.dataTransfer.items[0]) {
      setDragging(true);
    }
  };

  const dragleaveListener = (event: DragEvent<HTMLDivElement>) => {
    overrideEventDefaults(event);
    dragEventCounter -= 1;

    if (dragEventCounter === 0) {
      setDragging(false);
    }
  };

  const dropListener = (event: DragEvent<HTMLDivElement>) => {
    overrideEventDefaults(event);
    dragEventCounter = 0;
    setDragging(false);

    if (event.dataTransfer.files && event.dataTransfer.files[0]) {
      setFile(event.dataTransfer.files[0]);
      onSubmitted(event.dataTransfer.files);
    }
  };

  const onFileChanged = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setFile(event.target.files[0]);
      onSubmitted(event.target.files);
    }
  };

  useEffect(() => {
    window.addEventListener('dragover', (event: Event) => {
      overrideEventDefaults(event);
    });
    window.addEventListener('drop', (event: Event) => {
      overrideEventDefaults(event);
    });

    return () => {
      window.removeEventListener('dragover', overrideEventDefaults);
      window.removeEventListener('drop', overrideEventDefaults);
    };
  }, []);

  return (
    <FileUploaderPresentationalComponent
      dragging={dragging}
      file={file}
      errors={errors}
      onDrag={overrideEventDefaults}
      onDragStart={overrideEventDefaults}
      onDragEnd={overrideEventDefaults}
      onDragOver={overrideEventDefaults}
      onDragEnter={dragenterListener}
      onDragLeave={dragleaveListener}
      onDrop={dropListener}
      noFileText={noFileText}
      text={text}
      small={small}
    >
      <input
        ref={fileUploaderInput}
        type="file"
        className="file-uploader__input"
        onChange={onFileChanged}
        id="formFile"
        multiple={multiple}
      />
      <div className="mb-3">
        <Button
          onClick={() => fileUploaderInput.current?.click()}
          value={buttonText}
        ></Button>
      </div>
    </FileUploaderPresentationalComponent>
  );
};

export default FileUploader;
