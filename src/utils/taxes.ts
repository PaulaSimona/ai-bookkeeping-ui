export const get_gst = (amount: number, province: string) => {
  let gst = 0;
  if (['AB', 'MB', 'NT', 'NU', 'QC', 'SK', 'YT', 'BC'].includes(province)) {
    gst = amount * 0.05;
  }
  return gst;
};

export const get_pst = (amount: number, province: string) => {
  let pst = 0;
  if (province === 'MB' || province === 'BC') {
    pst = amount * 0.07;
  } else if (province === 'SK') {
    pst = amount * 0.06;
  }
  return pst;
};

export const get_hst = (amount: number, province: string) => {
  let hst = 0;
  if (
    province === 'NL' ||
    province === 'NB' ||
    province === 'NS' ||
    province === 'PE'
  ) {
    hst = amount * 0.15;
  } else if (province === 'ON') {
    hst = amount * 0.13;
  }
  return hst;
};

export const get_qst = (amount: number, province: string) => {
  let qst = 0;
  if (province === 'QC') {
    qst = amount * 0.09975;
  }
  return qst;
};
