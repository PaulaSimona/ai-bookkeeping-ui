import { FC, useMemo, useState } from 'react';
import { Col, Container, Row } from 'react-bootstrap';
import FileUploader from '../../components/DragAndDrop/FileUploader';
import { Button } from '../../components/Button/Button';
import { getSize } from '../../utils/handlers';
import { VALID_TYPE_TO_UPLOAD } from '../../utils/constants';
import { uploadValidator } from '../../utils/upload_validator';

// TODO: update this value when user is set in the backend
const LIMIT_FILES = 10;

export const UploadDocuments: FC = () => {
  const [errors, setErrors] = useState<string[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const total = useMemo(() => {
    if (files.length > 0) {
      return files.reduce((res: number, file) => res + file.size, 0);
    }
    return 0;
  }, [files]);

  const uploadFile = (newFiles: FileList) => {
    if (files.length >= LIMIT_FILES) {
      setErrors(['Max limit of files is ' + LIMIT_FILES]);
      return;
    }

    let newFilesList: File[] = Array.from(newFiles);
    const filesLength = newFilesList.length;
    newFilesList = newFilesList.filter((f: File) =>
      uploadValidator(f, VALID_TYPE_TO_UPLOAD),
    );
    if (filesLength != newFilesList.length) {
      setErrors([
        'There are invalid files, only accepted extension files JPG, PNG and PDF.',
      ]);
    }
    let newFilesUploaded = [...files, ...newFilesList];
    if (newFilesUploaded.length >= LIMIT_FILES) {
      setErrors(['Max limit of files is ' + LIMIT_FILES]);
      newFilesUploaded = newFilesUploaded.slice(0, 10);
    }

    setFiles(newFilesUploaded);
  };

  const deleteFile = (index: number) => {
    const newFiles = [...files];
    newFiles.splice(index, 1);
    setFiles(newFiles);
    // TODO: Check in the parent how to handle the files sent.
  };

  const onUploadDocuments = () => {
    console.log('onUploadDocuments');
  };

  const onDownload = () => {
    console.log('onDownload');
  };

  return (
    <Container style={{ maxWidth: 960 }} className="my-4 documents">
      <Row>
        <Col>
          <h2 className="px-2 mb-4">Upload Documents</h2>
        </Col>
      </Row>
      <Row>
        <Col>
          <div className="files_uploader mb-4">
            <FileUploader
              onSubmitted={uploadFile}
              buttonText="load documents"
              noFileText={false}
              text="Drag and drop documents."
              errors={errors}
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
                  <strong>Number of files:</strong> {files.length} {' - '}
                  <strong>Total size:</strong> {getSize(total)}
                </div>
              </div>
            )}
          </div>
        </Col>
      </Row>
      <Row>
        <Col xs={12} className="mb-4">
          <div className="d-grid gap-2">
            <Button
              variant="primary"
              icon="upload"
              value="UPLOAD DOCUMENTS"
              onClick={onUploadDocuments}
              disabled={files.length == 0}
            />
          </div>
        </Col>
      </Row>
      <Row>
        <Col xs={12} lg={6} className="mb-4">
          <div className="d-grid gap-2">
            <Button
              variant="outline-primary"
              icon="eye"
              value="VIEW DOCUMENTS"
              onClick={onUploadDocuments}
              disabled={files.length == 0}
            />
          </div>
        </Col>
        <Col xs={12} lg={6} className="mb-4">
          <div className="d-grid gap-2">
            <Button
              variant="success"
              icon="download"
              value="DOWNLOAD CSV FILE"
              onClick={onDownload}
              disabled={files.length == 0}
            />
          </div>
        </Col>
      </Row>
    </Container>
  );
};
