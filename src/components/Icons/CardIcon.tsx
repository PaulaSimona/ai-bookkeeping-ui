import { memo } from 'react';

export const CardIcon = memo(({ card }: { card: string }) => {
  const card_code = card === 'diners' ? 'diners-club' : card;

  if (card === 'unionpay') return <i className="fas fa-credit-card"></i>;

  return <i className={`fab fa-cc-${card_code}`}></i>;
});
