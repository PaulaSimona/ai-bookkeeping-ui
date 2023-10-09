export const uploadValidator = (element: File, valid_list: string[]) => {
  return valid_list.includes(element.type);
};
