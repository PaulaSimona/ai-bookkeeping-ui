import api from '../../utils/api';
import { useToast } from '../../hooks/useToast';
import { useState } from 'react';

type DocumentType = {
  image: string;
  type: string;
  name: string;
};

export const useDocuments = () => {
  const [isLoading, setLoading] = useState(false);
  const { showToast } = useToast();

  const uploadDocument = async (data: DocumentType) => {
    setLoading(true);
    return api.post('api/documents/upload', data).then((res) => {
      if (res.status === 201) {
        console.log('uploadDocument', res.data);
        showToast({
          title: 'Document uploaded',
          message: 'Document was uploaded successfully.',
          variant: 'success',
        });
      } else {
        showToast({
          title: 'Document not uploaded',
          message: 'Document was not uploaded successfully.',
          variant: 'danger',
        });
      }
      setLoading(false);

      return res;
    });
  };
  return { uploadDocument, isLoading };
};
