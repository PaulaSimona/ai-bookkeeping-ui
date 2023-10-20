export const getBase64 = (file: File) => {
  return new Promise((resolve) => {
    let baseURL = '';
    // Make new FileReader
    const reader = new FileReader();

    // Convert the file to base64 text
    reader.readAsDataURL(file);

    reader.onload = () => {
      // Make a fileInfo Object
      if (reader.result !== null) {
        baseURL = reader.result as string;
        resolve(baseURL);
      }
    };
  });
};
