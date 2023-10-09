import { FC, useMemo, useState } from 'react';
import { getSize } from '../../utils/handlers';
import FileUploader from './FileUploader';

interface FilesUploaderProps {
  onFileSubmitted(file: any): void;
}

export const FilesUploader: FC<FilesUploaderProps> = ({ onFileSubmitted }) => {
  // TODO: review if it's necessary handle any error
  // const [errors, setErrors] = useState<string[]>([]);

  const errors: string[] = [];
  const [files, setFiles] = useState<any[]>([]);
  const total = useMemo(() => {
    if (files.length > 0) {
      return files.reduce((res: number, file) => res + file.size, 0);
    }
    return 0;
  }, [files]);

  const uploadFile = (newFiles: any) => {
    setFiles([...files, ...newFiles]);
  };

  const deleteFile = (index: number) => {
    const newFiles = [...files];
    newFiles.splice(index, 1);
    setFiles(newFiles);
    onFileSubmitted(newFiles);
    // TODO: Check in the parent how to handle the files sent.
  };

  return (
    <div className="files_uploader">
      <FileUploader
        onSubmitted={uploadFile}
        buttonText="Abrir Archivos"
        text="Arrastra tus archivos aquí"
        errors={errors}
        small
        multiple
      />
      {files.length > 0 && (
        <div>
          {files.map((file: any, index: number) => (
            <div className="file_item">
              <div className="file_item_name">{file.name}</div>
              <div className="file_item_size">{getSize(file.size)}</div>
              <div
                className="file_item_action"
                onClick={() => deleteFile(index)}
                role="button"
                tabIndex={0}
                onKeyDown={() => null}
              >
                <i className="fa fa-times" />
              </div>
            </div>
          ))}
          <div className="file_total">
            <strong>Número de archivos:</strong> {files.length} {' - '}
            <strong>Tamaño total:</strong> {getSize(total)}
          </div>
        </div>
      )}
    </div>
  );
};
