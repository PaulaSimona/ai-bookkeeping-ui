import { FC, useEffect, useMemo, useState } from 'react';
import { Col, Container, Row } from 'react-bootstrap';
import FileUploader from '../../components/DragAndDrop/FileUploader';
import { Button } from '../../components/Button/Button';
import { getSize } from '../../utils/handlers';
import { VALID_TYPE_TO_UPLOAD } from '../../utils/constants';
import { uploadValidator } from '../../utils/upload_validator';
import { useDocuments } from '../../api/documents/useDocuments';
import { getBase64 } from '../../utils/file';
import { usePackage } from '../../api/packages/usePackage';
import { Modal } from '../../components/Modal';
import { NoStorageAlert } from './components/NoStorageAlert';
import { BuyAdditionalStorageSpace } from './components/BuyAdditionalStorageSpace';

// TODO: update this value when user is set in the backend
const LIMIT_FILES = 1;

export const UploadDocuments: FC = () => {
  const [errors, setErrors] = useState<string[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [showNoStorageAlert, setShowNoStorageAlert] = useState(false);
  const [showBuyAdditionalStorage, setShowBuyAdditionalStorage] =
    useState(false);
  const { getUserPackagesStatus, number_of_documents, storage_space } =
    usePackage();

  const total_size = useMemo(() => {
    return getSize(storage_space);
  }, [storage_space]);

  const total = useMemo(() => {
    if (files.length > 0) {
      return files.reduce((res: number, file) => res + file.size, 0);
    }
    return 0;
  }, [files]);
  const { uploadDocument, isLoading } = useDocuments();

  const uploadFile = async (newFiles: FileList) => {
    if (files.length >= LIMIT_FILES) {
      setErrors(['Max limit of files is ' + LIMIT_FILES]);
      return;
    }

    let newFilesList: File[] = Array.from(newFiles);
    const filesLength = newFilesList.length;
    newFilesList = newFilesList.filter((f: File) =>
      uploadValidator(f, VALID_TYPE_TO_UPLOAD),
    );

    // control the type of files
    if (filesLength != newFilesList.length) {
      setErrors([
        'There are invalid files, only accepted extension files JPG, PNG and PDF.',
      ]);
    }

    // control the limit of files
    let newFilesUploaded = [...files, ...newFilesList];
    if (newFilesUploaded.length >= LIMIT_FILES) {
      setErrors(['Max limit of files is ' + LIMIT_FILES]);
      newFilesUploaded = newFilesUploaded.slice(0, 10);
    }

    // Generate the base64 for each file
    for (let index = 0; index < newFilesUploaded.length; index++) {
      const result = await getBase64(newFilesUploaded[index]);
      newFilesUploaded[index]['base64'] = `${result}`.split(',')[1];
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
    const total_size = files.reduce((res: number, file) => res + file.size, 0);
    if (number_of_documents < files.length || storage_space < total_size) {
      setShowNoStorageAlert(true);
      return;
    }
    const data = {
      image: files[0].base64,
      type: files[0].type,
      name: files[0].name,
    };
    uploadDocument(data).then((res) => {
      if (res.status === 201) {
        setFiles([]);
        setErrors([]);
        getUserPackagesStatus();
      }
    });
  };

  const onDownload = () => {
    console.log('onDownload');
  };

  const onClickBuyStorage = () => {
    setShowNoStorageAlert(false);
    setShowBuyAdditionalStorage(true);
  };

  useEffect(() => {
    getUserPackagesStatus();
  }, [getUserPackagesStatus]);

  return (
    <Container style={{ maxWidth: 960 }} className="my-4 documents">
      <Row>
        <Col>
          <h2 className="px-2 mb-4">Upload Documents</h2>
        </Col>
      </Row>
      <Row>
        <Col className="mb-4 px-2 d-flex justify-content-between">
          <div className="px-2 text-small">
            <small>
              <strong>documents:</strong>{' '}
              <span className={number_of_documents === 0 ? 'text-danger' : ''}>
                {number_of_documents}
              </span>
              {' - '}
              <strong>storage:</strong> <span>{total_size}</span>
            </small>
          </div>
          <div>
            <Button
              value="Buy Additional Storage Space"
              size="sm"
              onClick={() => setShowBuyAdditionalStorage(true)}
            />
          </div>
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
                  <div className="file_item" key={file.name}>
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
              value={isLoading ? 'UPLOADING DOCUMENTS...' : 'UPLOAD DOCUMENTS'}
              onClick={onUploadDocuments}
              disabled={files.length == 0 || isLoading}
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

      <Modal
        opened={showNoStorageAlert}
        title="No storage available"
        dialogClassName="modal_no_storage"
        contain={<NoStorageAlert onClickButton={onClickBuyStorage} />}
        handleClose={() => setShowNoStorageAlert(false)}
        onAccept={() => {}}
        noActions
      />

      <Modal
        opened={showBuyAdditionalStorage}
        title="Buy Additional Storage Space"
        dialogClassName="modal_buy_additional_storage"
        contain={
          <BuyAdditionalStorageSpace
            onSuccess={() => {
              setShowBuyAdditionalStorage(false);
            }}
          />
        }
        handleClose={() => setShowBuyAdditionalStorage(false)}
        onAccept={() => {}}
        noActions
      />
    </Container>
  );
};
